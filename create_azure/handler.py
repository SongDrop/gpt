import json
import logging
import os
import time
import dns.resolver
from datetime import datetime, timedelta
from azure.core.exceptions import ClientAuthenticationError
from azure.identity import ClientSecretCredential
from azure.storage.blob import (BlobServiceClient, generate_blob_sas, BlobSasPermissions)

from azure.mgmt.resource import ResourceManagementClient
from azure.mgmt.network import NetworkManagementClient
from azure.mgmt.network.models import (
    NetworkSecurityGroup, SecurityRule,NetworkInterface
)
from azure.mgmt.compute import ComputeManagementClient
from azure.mgmt.compute.models import (
    VirtualMachine, HardwareProfile, StorageProfile,
    OSProfile, NetworkProfile, NetworkInterfaceReference,
    VirtualMachineExtension
)
from azure.mgmt.dns import DnsManagementClient
from azure.mgmt.dns.models import RecordSet

from azure.mgmt.storage import StorageManagementClient
from azure.mgmt.search import SearchManagementClient
from azure.mgmt.search.models import SearchService, Sku as SearchSku
from azure.mgmt.openai import OpenAIManagementClient
from azure.mgmt.openai.models import OpenAIResource
from azure.mgmt.resource.subscriptions import SubscriptionClient
from azure.mgmt.cognitiveservices import CognitiveServicesManagementClient

#setup.sh script generator to autoinstall everything
import generate_setup as generate_setup

# App Config from environment variables
DOMAIN_NAME = 'sdappnet.com' # e.g. example.com
DOMAIN_SUBDOMAIN = 'chat.' # e.g. chat. -> chat.example.com or leave it empty '' if you host on the main domain
APP_NAME = 'AI Chat Assistant'
APP_LOGO_URL = 'https://i.postimg.cc/C53CqTfx/chatgpt.png'
APP_REPO_URL = 'https://github.com/SongDrop/gpt-chat'

#Azure Resource Config
RESOURCE_GROUP_NAME = 'rtxdev-1' #resource group name storing everything need for the computer
VM_NAME = 'ai-assistant-ubuntu-vm' #name of the computer to run the app
VM_SIZE = 'Standard_D2s_v3' #computer to run the app
OS_OFFER = 'UbuntuServer'
OS_IMAGE_SKU = '22.04-LTS'  # Ubuntu 22.04 LTS
OS_DISK_SSD_GB = '30' # how big is the storage for the ubuntu machine in GB
VM_USERNAME = 'azureuser'
VM_PASSWORD = 'aiassistantchat1234!'
VM_LOCATION = 'southuk'
STORAGE_ACCOUNT_NAME = "ai-assistant-storage"  # must be globally unique, lowercase, 3-24 chars
AZURE_VM_SETUP_SCRIPT_CONTAINER_NAME = 'ai_assistant_startups_scripts'
AZURE_FILE_UPLOAD_CONTAINER_NAME = 'ai_assistant_file_upload'
SEARCH_SERVICE_NAME = "ai-assistant-search"
OPENAI_RESOURCE_NAME = "ai-assistant-gpt"
#Vector Search Config
SEARCH_SEMANTIC_CONFIG = 'azureml-default' #don't change this
SEARCH_EMBEDDING_DEPLOYMENT = 'text-embedding-ada-002' #don't change this
#Azure Auth specific stuff to create resource (must obtain this first)
AZURE_CLIENT_ID = os.environ['AZURE_CLIENT_ID']
AZURE_CLIENT_SECRET = os.environ['AZURE_CLIENT_SECRET']
AZURE_TENANT_ID = os.environ['AZURE_TENANT_ID']
AZURE_SUBSCRIPTION_ID = os.environ['AZURE_SUBSCRIPTION_ID']
ADMIN_USERNAME = os.environ.get('ADMIN_USERNAME', VM_USERNAME)
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', VM_PASSWORD)
AZURE_LOCATION = os.environ.get('AZURE_LOCATION', VM_LOCATION)


# Ports to open for application [without this app can't run on domain]
PORTS_TO_OPEN = [22, 80, 443, 8000]

# Setup logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)


# Function to establish Azure connection
def make_connection():
    try:
        return ClientSecretCredential(
            client_id=AZURE_CLIENT_ID,
            client_secret=AZURE_CLIENT_SECRET,
            tenant_id=AZURE_TENANT_ID
        )
    except ClientAuthenticationError as err:
        logger.error(f"Azure authentication error: {err}")
        raise

#main function
async def main(event, context):
    try:
 
        # Establish Azure connection
        credentials = make_connection()

        is_configured = await check_azure_dns_configuration(DOMAIN_NAME)
        if is_configured:
            print("Domain is using Azure DNS nameservers")
        else:
            return log_err(
                "Domain is NOT properly configured with Azure DNS nameservers.\n\n"
                "To fix this, please update your domain's nameservers at your registrar to:\n"
                "1. ns1-03.azure-dns.com\n"
                "2. ns2-03.azure-dns.net\n"
                "3. ns3-03.azure-dns.org\n"
                "4. ns4-03.azure-dns.info\n\n"
                "Steps:\n"
                "1. Log in to your domain registrar (where you bought the domain)\n"
                "2. Find DNS/Nameserver settings\n"
                "3. Replace existing nameservers with the Azure DNS nameservers above\n"
                "4. Save changes (may take 24-48 hours to propagate)\n\n"
                "Note: This change must be made at your domain registrar (like GoDaddy, Namecheap, etc.) "
                "before the domain will work with Azure resources."
            )
        
        # Get quotas first to see if azure-user can create required infrastructure
        cognitive_client = CognitiveServicesManagementClient(credentials, AZURE_SUBSCRIPTION_ID)
        compute_client = ComputeManagementClient(credentials, AZURE_SUBSCRIPTION_ID)
        storage_client = StorageManagementClient(credentials, AZURE_SUBSCRIPTION_ID)
        network_client = NetworkManagementClient(credentials, AZURE_SUBSCRIPTION_ID)

        # OpenAI regions a bit hesty
        region_sku_map = await get_openai_supported_regions(cognitive_client)
        print(region_sku_map)  # e.g., {'uksouth': ['S0'], 'westus3': ['S0'], ...}

        quota_info = {}
        try:
            get_openai_quota_and_usage_result = await get_openai_quota_and_usage(credentials, AZURE_SUBSCRIPTION_ID, AZURE_LOCATION)
            quota_info = get_openai_quota_and_usage_result
        except Exception as e:
            logger.warning(f"Quota info request failed: {str(e)}")
            return log_err(f"Quota info request failed: {str(e)}")

        # Check quotas
        logger.info(f"OpenAI quota info: {quota_info}")
        # Example check: Ensure deployment quota available
        deployment_quota = next((u for u in quota_info['usage'] if u['name'] == 'OpenAIUnits'), None)
        if deployment_quota and deployment_quota['current_value'] >= deployment_quota['limit']:
            return log_err("OpenAI deployment quota exceeded in this region. Cannot create new deployments.")


        vm_quota = await check_vm_quota_and_usage(compute_client, AZURE_LOCATION)
        storage_quota = await check_storage_quota_and_usage(storage_client, AZURE_LOCATION)
        network_quota = await check_network_quota_and_usage(network_client, AZURE_LOCATION)

        logger.info(f"VM Quotas: {vm_quota}")
        logger.info(f"Storage Quotas: {storage_quota}")
        logger.info(f"Network Quotas: {network_quota}")

        # Example VM quota check: ensure cores available
        core_quota = next((q for q in vm_quota if q['name'] == 'Total Regional vCPUs'), None)
        if core_quota and core_quota['current_value'] >= core_quota['limit']:
            return log_err("VM vCPU quota exceeded in this region.")


        logger.info(f"Quota request check was successful --- initiating creation process -- please hold on ------")

        # 1. Create resource group
        logger.info(f"Creating resource group {RESOURCE_GROUP_NAME} in {AZURE_LOCATION}")

        resource_client = ResourceManagementClient(credentials, AZURE_SUBSCRIPTION_ID)
        resource_client.resource_groups.create_or_update(
            RESOURCE_GROUP_NAME,
            {'location': AZURE_LOCATION}
        )
        # 2. Create storage account 
        # must be globally unique, lowercase, 3-24 chars
        default_storage = f"{STORAGE_ACCOUNT_NAME}-{int(time.time()) % 10000}"
        try:
            storage_config = await create_storage_account(
                credentials, 
                RESOURCE_GROUP_NAME, 
                default_storage,
                AZURE_LOCATION
            )
        except Exception as e:
            logger.warning(f"Storage creation `{STORAGE_ACCOUNT_NAME}` failed: {str(e)}")
            return log_err(f"Storage creation `{STORAGE_ACCOUNT_NAME}`a failed: {str(e)}")
        
        # Set the storage URL and key as global variables
        global AZURE_STORAGE_URL, AZURE_STORAGE_ACCOUNT_KEY
        AZURE_STORAGE_URL = storage_config["AZURE_STORAGE_URL"]
        AZURE_STORAGE_ACCOUNT_KEY = storage_config["AZURE_STORAGE_KEY"]


        vector_upload_container_settings = {}
        # 2. Create Vector File Upload Storage container
        # return {
        #     "storage_url": f"https://{storage_account_name}.blob.core.windows.net",
        #     "api_key": storage_key,
        #     "account_name": storage_account_name,
        #     "container_name": container_name,
        # }
        # Initialize container client
        try:
            create_vector_storage_container_result = await create_vector_storage_container(DOMAIN_NAME, credentials, RESOURCE_GROUP_NAME, STORAGE_ACCOUNT_NAME, AZURE_FILE_UPLOAD_CONTAINER_NAME)
            vector_upload_container_settings = create_vector_storage_container_result
        except Exception as e:
            logger.warning(f"Vector container (file_upload) creation failed: {str(e)}")
            return log_err(f"Vector container (file_upload) creation failed: {str(e)}")
        
        
        # 3. Create open_ai services gpt-image-1, gpt-4.1-mini, azure-vector-search
        # return = {
        #     "OPENAI_API_BASE": f"https://{resource_name}.cognitiveservices.azure.com/openai/deployments/gpt-4.1-mini/chat/completions?api-version=2025-01-01-preview",
        #     "OPENAI_API_KEY": keys.key1,
        #     "OPENAI_DEPLOYMENT_NAME": "gpt-4.1-mini",
        #     "OPENAI_API_VERSION": "2023-05-15",
        #     "VECTOR_SEARCH_KEY": keys.key1,
        #     "VECTOR_SEARCH_INDEX": vector_index,
        #     "GPT_IMAGE_API_BASE": f"https://{resource_name}.cognitiveservices.azure.com/openai/deployments/gpt-image-1/images",
        #     "GPT_IMAGE_API_KEY": keys.key1,
        #     "GPT_IMAGE_DEPLOYMENT_NAME": "gpt-image-1",
        #     "GPT_IMAGE_API_VERSION": "2025-04-01-preview"
        # }
        open_ai_config = {}
        # Initialize clients for additional services
        openai_client = OpenAIManagementClient(credentials, AZURE_SUBSCRIPTION_ID)
        try:
            create_open_ai_resource_result = await create_openai_resource(openai_client, RESOURCE_GROUP_NAME, OPENAI_RESOURCE_NAME, AZURE_LOCATION)
            open_ai_config = create_open_ai_resource_result
        except Exception as e:
            logger.warning(f"OpenAI service creation failed: {str(e)}")
            return log_err(f"OpenAI service creation failed: {str(e)}")
        

        # Generate Auto-setup setup script
        GIT_REPO_URL = APP_REPO_URL
        REACT_APP_LOGO_URL = APP_LOGO_URL
        APP_DOMAIN = f'{DOMAIN_SUBDOMAIN}{DOMAIN_NAME}'
        SSL_EMAIL = f'admin@{DOMAIN_NAME}'
        OPENAI_API_BASE = open_ai_config["OPENAI_API_BASE"]
        OPENAI_API_KEY = open_ai_config["OPENAI_API_KEY"]
        OPENAI_DEPLOYMENT_NAME = open_ai_config["OPENAI_DEPLOYMENT_NAME"]
        OPENAI_API_VERSION = open_ai_config["OPENAI_API_VERSION"]
        REACT_APP_NAME = APP_NAME
        ENVIRONMENT = 'production'
        CORS_ORIGINS = f'{APP_DOMAIN}'
        VECTOR_STORAGE_API_BASE = vector_upload_container_settings["storage_url"]
        VECTOR_STORAGE_API_KEY = vector_upload_container_settings["api_key"]
        VECTOR_SEARCH_ENABLED = 'true'
        VECTOR_SEARCH_KEY = open_ai_config["VECTOR_SEARCH_KEY"]
        VECTOR_SEARCH_INDEX = open_ai_config["VECTOR_SEARCH_INDEX"]
        VECTOR_SEARCH_SEMANTIC_CONFIG = SEARCH_SEMANTIC_CONFIG
        VECTOR_SEARCH_EMBEDDING_DEPLOYMENT = SEARCH_EMBEDDING_DEPLOYMENT
        REACT_APP_GPT_IMAGE_URL = open_ai_config["GPT_IMAGE_API_BASE"]
        REACT_APP_GPT_IMAGE_KEY = open_ai_config["GPT_IMAGE_API_KEY"]
        REACT_APP_GPT_IMAGE_VERSION = open_ai_config["GPT_IMAGE_API_VERSION"]
        
        script_content = generate_setup(
            GIT_REPO_URL,
            APP_DOMAIN,
            SSL_EMAIL,
            REACT_APP_NAME,
            REACT_APP_LOGO_URL,
            ENVIRONMENT,
            CORS_ORIGINS,
            OPENAI_API_BASE,
            OPENAI_API_KEY,
            OPENAI_DEPLOYMENT_NAME,
            OPENAI_API_VERSION,
            VECTOR_STORAGE_API_BASE,
            VECTOR_STORAGE_API_KEY,
            VECTOR_SEARCH_ENABLED,
            VECTOR_SEARCH_KEY,
            VECTOR_SEARCH_INDEX,
            VECTOR_SEARCH_SEMANTIC_CONFIG,
            VECTOR_SEARCH_EMBEDDING_DEPLOYMENT,
            REACT_APP_GPT_IMAGE_URL,
            REACT_APP_GPT_IMAGE_KEY,
            REACT_APP_GPT_IMAGE_VERSION
        )

        # 4. Upload setup script to Azure Blob Storage
        SETUP_SCRIPT_BLOB_NAME = f'{VM_NAME}-setup.sh'
        blob_service_client = BlobServiceClient(account_url=AZURE_STORAGE_URL, credential=credentials)

         # Set the storage URL and key as global variables
        global UPLOADED_BLOB_URL_WITH_SAS

        try:
            expires_in_hours = 1
            blob_storage = await upload_blob_and_generate_sas(blob_service_client,AZURE_VM_SETUP_SCRIPT_CONTAINER_NAME,SETUP_SCRIPT_BLOB_NAME,script_content,expires_in_hours)

            UPLOADED_BLOB_URL_WITH_SAS = blob_storage["AZURE_STORAGE_URL"]
    
        except Exception as e:
            logger.warning(f"Install script failed to upload: {str(e)}")
            return log_err(f"Install script failed to upload: {str(e)}")

        vm_setup_startup_script_url = UPLOADED_BLOB_URL_WITH_SAS
        logger.info(f"Script uploaded to blob storage: {vm_setup_startup_script_url}")

        # 5. Create VNet and subnet
        network_client = NetworkManagementClient(credentials, AZURE_SUBSCRIPTION_ID)
        vnet_name = f'{VM_NAME}-vnet'
        subnet_name = f'{VM_NAME}-subnet'

        # Create VNet
        network_client.virtual_networks.begin_create_or_update(
            RESOURCE_GROUP_NAME,
            vnet_name,
            {
                'location': AZURE_LOCATION,
                'address_space': {'address_prefixes': ['10.1.0.0/16']},
                'subnets': [{'name': subnet_name, 'address_prefix': '10.1.0.0/24'}]
            }
        ).result()

        # 6. Create Public IP
        public_ip_name = f'{VM_NAME}-public-ip'
        public_ip_params = {
            'location': AZURE_LOCATION,
            'public_ip_allocation_method': 'Dynamic'
        }

        public_ip = network_client.public_ip_addresses.begin_create_or_update(
            RESOURCE_GROUP_NAME,
            public_ip_name,
            public_ip_params
        ).result()

        # Define subnet_id and public_ip_id
        subnet_id = f'/subscriptions/{AZURE_SUBSCRIPTION_ID}/resourceGroups/{RESOURCE_GROUP_NAME}/providers/Microsoft.Network/virtualNetworks/{vnet_name}/subnets/{subnet_name}'
        public_ip_id = f'/subscriptions/{AZURE_SUBSCRIPTION_ID}/resourceGroups/{RESOURCE_GROUP_NAME}/providers/Microsoft.Network/publicIPAddresses/{public_ip_name}'

        # 6. Handle Network Security Group
        nsg_name = f'{VM_NAME}-nsg'
        nsg = None
        try:
            nsg = network_client.network_security_groups.get(RESOURCE_GROUP_NAME, nsg_name)
            logger.info(f"NSG {nsg_name} found.")
        except Exception as e:
            logger.warning(f"NSG {nsg_name} not found, creating new NSG.")
            nsg_params = NetworkSecurityGroup(location=AZURE_LOCATION, security_rules=[])
            nsg_creation = network_client.network_security_groups.begin_create_or_update(
                RESOURCE_GROUP_NAME, nsg_name, nsg_params
            ).result()
            logger.info(f"NSG {nsg_name} created.")
            nsg = nsg_creation

        # Define rules for ports for RTX and RTX SSL
        ports = PORTS_TO_OPEN
        rules = []

        for i, port in enumerate(ports, start=100):
            rule = SecurityRule(
                name=f'AllowPort{port}',
                access='Allow',
                direction='Inbound',
                priority=i,
                protocol='*',
                source_address_prefix='*',
                destination_address_prefix='*',
                destination_port_range=str(port),
                source_port_range='*'
            )
            rules.append(rule)

        if nsg:
            nsg.security_rules.extend(rules)
            try:
                network_client.network_security_groups.begin_create_or_update(
                    RESOURCE_GROUP_NAME,
                    nsg_name,
                    nsg
                ).result()  # Wait for the update to complete
                logger.info(f"Network Security Group updated with rules for ports: {', '.join(map(str, ports))}")
            except Exception as e:
                logger.error(f"Failed to update NSG {nsg_name}: {str(e)}")

        # Create Network Interface with NSG association
        nic_parameters = NetworkInterface(
            location=AZURE_LOCATION,
            ip_configurations=[{
                'name': f'{VM_NAME}-ip-config',
                'subnet': {'id': subnet_id},
                'public_ip_address': {'id': public_ip_id}
            }],
            network_security_group={'id': f'/subscriptions/{AZURE_SUBSCRIPTION_ID}/resourceGroups/{RESOURCE_GROUP_NAME}/providers/Microsoft.Network/networkSecurityGroups/{nsg_name}'}
        )

        async_nic_creation = network_client.network_interfaces.begin_create_or_update(
            RESOURCE_GROUP_NAME,
            f'{VM_NAME}-nic',
            nic_parameters
        )
        async_nic_creation.result()
        logger.info(f"Network Interface {VM_NAME}-nic created successfully.")

        # 8. Create Virtual Machine
        compute_client = ComputeManagementClient(credentials, AZURE_SUBSCRIPTION_ID)
        os_disk = {
            'name': f'{VM_NAME}-os-disk',
            'managed_disk': {
                'storage_account_type': 'Standard_LRS'
            },
            'create_option': 'FromImage',
            'disk_size_gb': f"{int(OS_DISK_SSD_GB)}"
        }

        vm_parameters = VirtualMachine(
            location=AZURE_LOCATION,
            hardware_profile=HardwareProfile(vm_size=VM_SIZE),
            storage_profile=StorageProfile(
                os_disk=os_disk,
                image_reference={
                    'publisher': 'canonical',
                    'offer': OS_OFFER,
                    'sku': OS_IMAGE_SKU,
                    'version': 'latest',
                    'exactVersion': '24.04.202409120'
                }
            ),
            os_profile={
                'computer_name': VM_NAME,
                'admin_username': VM_USERNAME,
                'admin_password': VM_PASSWORD
            },
            zones=None,
            network_profile=NetworkProfile(
                network_interfaces=[
                    NetworkInterfaceReference(id=f'/subscriptions/{AZURE_SUBSCRIPTION_ID}/resourceGroups/{RESOURCE_GROUP_NAME}/providers/Microsoft.Network/networkInterfaces/{VM_NAME}-nic')
                ]
            )
        )

        async_vm_creation = compute_client.virtual_machines.begin_create_or_update(
            RESOURCE_GROUP_NAME,
            VM_NAME,
            vm_parameters
        )
        vm = async_vm_creation.result()

        # 9. Extract IP address from VM's NIC
        nic_id = vm.network_profile.network_interfaces[0].id
        nic_name = nic_id.split('/')[-1]
        nic_client = network_client.network_interfaces.get(RESOURCE_GROUP_NAME, nic_name)

        if nic_client.ip_configurations:
            public_ip_address = nic_client.ip_configurations[0].public_ip_address.id.split('/')[-1]
            public_ip_info = network_client.public_ip_addresses.get(RESOURCE_GROUP_NAME, public_ip_address)
            public_ip = public_ip_info.ip_address
            logger.info(f"VM created with Public IP: {public_ip}")
        else:
            return log_err("No public IP configuration found for the NIC.")


        # 10. Ensure DNS Zone exists (create if missing)
        dns_client = DnsManagementClient(credentials, AZURE_SUBSCRIPTION_ID)
        try:
            dns_zone = dns_client.zones.get(RESOURCE_GROUP_NAME, DOMAIN_NAME)
            logger.info(f"DNS zone '{DOMAIN_NAME}' already exists.")
        except Exception as e:
            logger.warning(f"DNS zone '{DOMAIN_NAME}' not found. Creating new zone.")
            dns_zone = dns_client.zones.create_or_update(
                RESOURCE_GROUP_NAME,
                DOMAIN_NAME,
                {
                    'location': 'global'  # DNS zones use 'global' location
                }
            )
            logger.info(f"DNS zone '{DOMAIN_NAME}' created.")

       
        # 11. Update DNS Zone with A records
        a_record_set = RecordSet(ttl=3600, a_records=[{'ipv4_address': public_ip}])
        dns_client.record_sets.create_or_update(
            RESOURCE_GROUP_NAME,
            DOMAIN_NAME,
            DOMAIN_SUBDOMAIN.rstrip('.'),
            'A',
            a_record_set
        )
        logger.info(f"DNS A record created for {APP_DOMAIN} with IP: {public_ip}")

        # Create Extension for script setup .sh
        ext_params = {
            'location': AZURE_LOCATION,
            'publisher': 'Microsoft.Azure.Extensions',
            'type': 'CustomScript',
            'type_handler_version': '2.0',
            'settings': {
                'fileUris': [vm_setup_startup_script_url],
                'commandToExecute': f'sh {SETUP_SCRIPT_BLOB_NAME}',  # Update command accordingly
            },
        }
        
 
        ext_poller = compute_client.virtual_machine_extensions.begin_create_or_update(
            RESOURCE_GROUP_NAME,
            VM_NAME,
            'customScriptExtension',
            ext_params,
        )
        ext = ext_poller.result()
        logger.info(f'Extension deployed: {ext.name}')


        result =  {
                "message": "VM and infrastructure created successfully",
                "public_ip": public_ip.ip_address,
                "domain": APP_DOMAIN
            }
        
        return success(result)

    except Exception as e:
        logger.error(f"Failed to create Azure VM and infrastructure: {e}")
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)})
        }

### CREATE STORAGE (storage can hold many containers)
async def create_storage_account(credentials, resource_group_name, storage_name, location):
    try:
        logger.info(f"Creating storage account {storage_name} in {location}")
        
        # Create storage management client
        storage_client = StorageManagementClient(credentials, AZURE_SUBSCRIPTION_ID)
        
        # Check if storage account already exists
        try:
            storage_account = storage_client.storage_accounts.get_properties(
                resource_group_name, 
                storage_name
            )
            logger.info(f"Storage account {storage_name} already exists")
        except:
            # Create storage account if it doesn't exist
            storage_async_operation = storage_client.storage_accounts.begin_create(
                resource_group_name,
                storage_name,
                {
                    "sku": {"name": "Standard_LRS"},
                    "kind": "StorageV2",
                    "location": location,
                    "enable_https_traffic_only": True
                }
            )
            storage_account = storage_async_operation.result()
            logger.info(f"Storage account {storage_name} created successfully")
        
        # Get storage account keys
        keys = storage_client.storage_accounts.list_keys(
            resource_group_name, 
            storage_name
        )
        storage_key = keys.keys[0].value
        
        # Construct storage URL
        storage_url = f"https://{storage_name}.blob.core.windows.net"
        
        return {
            "AZURE_STORAGE_URL": storage_url,
            "AZURE_STORAGE_NAME": storage_name,
            "AZURE_STORAGE_KEY": storage_key
        }
        
    except Exception as e:
        logger.error(f"Failed to create storage account: {str(e)}")
        raise Exception(f"Storage account creation failed: {str(e)}")

#CHECK IF CONTAINER EXISTS
def ensure_container_exists(blob_service_client: BlobServiceClient, container_name: str):
    container_client = blob_service_client.get_container_client(container_name)
    try:
        container_client.create_container()
        logger.info(f"Created container '{container_name}'.")
    except Exception as e:
        # Container likely already exists - log and continue
        logger.debug(f"Container '{container_name}' exists or could not be created: {e}")
    return container_client


async def create_vector_storage_container(
    domain: str,
    credentials: ClientSecretCredential,
    resource_group_name: str,
    storage_account_name: str,
    container_name: str = None
) -> dict:
    container_name = container_name or AZURE_FILE_UPLOAD_CONTAINER_NAME
    
    try:
        # Initialize clients
        storage_client = StorageManagementClient(credentials, AZURE_SUBSCRIPTION_ID)
        
        # Get storage account keys
        keys = storage_client.storage_accounts.list_keys(resource_group_name, storage_account_name)
        if not keys.keys:
            raise Exception("No access keys found for storage account")
        storage_key = keys.keys[0].value
        
        # Create blob service client
        blob_service_client = BlobServiceClient(
            account_url=f"https://{storage_account_name}.blob.core.windows.net",
            credential=storage_key
        )
        
        # Create/configure container
        container_client = blob_service_client.get_container_client(container_name)
        if not container_client.exists():
            container_client.create_container()
            logger.info(f"Created container '{container_name}'")
        
        # Configure CORS
        cors_rule = {
            'allowed_origins': [domain],
            'allowed_methods': ['GET', 'PUT', 'POST', 'HEAD', 'DELETE'],
            'allowed_headers': ['*'],
            'exposed_headers': ['*'],
            'max_age_in_seconds': 3600
        }
        
        # Get existing CORS rules to append rather than overwrite
        existing_props = container_client.get_container_properties()
        existing_cors = getattr(existing_props, 'cors', [])
        
        # Add our rule if not already present
        if not any(r['allowed_origins'] == [domain] for r in existing_cors):
            existing_cors.append(cors_rule)
            container_client.set_container_properties(cors=existing_cors)
            logger.info(f"Configured CORS for domain '{domain}'")
        
        return {
            "storage_url": f"https://{storage_account_name}.blob.core.windows.net",
            "api_key": storage_key,
            "account_name": storage_account_name,
            "container_name": container_name
        }
        
    except Exception as e:
        logger.error(f"Vector storage setup failed: {str(e)}", exc_info=True)
        raise Exception(f"Vector storage configuration error: {str(e)}")
    
async def upload_blob_and_generate_sas(
    blob_service_client: BlobServiceClient,
    container_name: str,
    blob_name: str,
    data: str,
    sas_expiry_hours: int = 1
):
    try:
        container_client = ensure_container_exists(blob_service_client, container_name)
        blob_client = container_client.get_blob_client(blob_name)

        blob_client.upload_blob(data, overwrite=True)
        logger.info(f"Uploaded blob '{blob_name}' to container '{container_name}'.")

        sas_token = ""
        try: 
            sas_token = generate_blob_sas(
            blob_service_client.account_name,
            AZURE_VM_SETUP_SCRIPT_CONTAINER_NAME,
            blob_name,
            permission=BlobSasPermissions(read=True),
            expiry=datetime.utcnow() + timedelta(hours=sas_expiry_hours), #1 hour to install - after sas_token_is_expired
            account_key=AZURE_STORAGE_ACCOUNT_KEY
        )
        except Exception as e:
            logger.error(f"Failed to generate SAS token: {str(e)}")
            raise Exception(f"Failed to generate SAS token: {str(e)}")
        
        blob_url = f"https://{blob_service_client.account_name}.blob.core.windows.net/{container_name}/{SETUP_SCRIPT_BLOB_NAME}"
        blob_url_with_sas = f"{blob_url}?{sas_token}"
        logger.info(f"SAS URL generated for blob '{blob_name}': {blob_url_with_sas}")

        return {
            "UPLOADED_BLOB_URL_WITH_SAS": blob_url_with_sas,
        }
    
    except Exception as e:
        logger.error(f"Failed to retrieve API keys: {str(e)}")
        raise Exception(f"API key retrieval failed: {str(e)}")


async def get_openai_supported_regions(cognitive_client):
    skus = cognitive_client.resource_skus.list()
    openai_skus = [sku for sku in skus if sku.resource_type == "accounts" and "openai" in sku.name.lower()]
    region_map = {}
    for sku in openai_skus:
        for loc in sku.locations:
            region_map.setdefault(loc.lower(), []).append(sku.name)
    return region_map
  
async def create_openai_resource(openai_client, resource_group, resource_name, location):
    try:
        logger.info(f"Creating Azure OpenAI resource {resource_name} with Global Standard SKU...")

        # 1. Create the base Azure OpenAI resource with GlobalStandard SKU
        try:
            base_params = OpenAIResource(
                location=location,
                sku={"name": "GlobalStandard"},  # Changed from "S0" to "GlobalStandard"
                properties={
                    "kind": "openai",
                    "custom_subdomain_name": resource_name
                }
            )
            base_poller = await openai_client.open_ai_resources.begin_create_or_update(
                resource_group,
                resource_name,
                base_params
            )
            base_resource = await base_poller.result()
            logger.info("Base OpenAI resource with Global Standard SKU created.")
        except Exception as e:
            logger.error(f"Failed to create base OpenAI resource: {str(e)}")
            raise Exception(f"Base resource creation failed: {str(e)}")

        # 2. Create GPT-4.1-mini deployment (assuming S0 SKU allowed here)
        try:
            logger.info("Creating GPT-4.1-mini deployment...")
            gpt41mini_params = {
                "model": {
                    "format": "OpenAI",
                    "name": "gpt-4.1-mini",
                    "version": "latest"
                },
                "scale_settings": {
                    "capacity": 20,
                    "scale_type": "manual"
                }
            }
            gpt41mini_poller = await openai_client.deployments.begin_create_or_update(
                resource_group,
                resource_name,
                "gpt-4-1-mini",
                gpt41mini_params
            )
            gpt41mini = await gpt41mini_poller.result()
            logger.info("GPT-4.1-mini deployment created.")
        except Exception as e:
            logger.error(f"Failed to create GPT-4.1-mini deployment: {str(e)}")
            raise Exception(f"GPT-4.1-mini deployment failed: {str(e)}")

        # 3. Create GPT-Image-1 deployment only if location supports it (e.g., "uaenorth")
        if location.lower() == "uaenorth":
            try:
                logger.info("Creating GPT-Image-1 deployment with Global Standard SKU requirements...")
                gpt_image_params = {
                    "model": {
                        "format": "OpenAI",
                        "name": "gpt-image-1",
                        "version": "latest"
                    },
                    "scale_settings": {
                        "capacity": 10,
                        "scale_type": "shared"  # For Global Standard, use "shared" or leave as per doc
                    }
                }
                gpt_image_poller = await openai_client.deployments.begin_create_or_update(
                    resource_group,
                    resource_name,
                    "gpt-image-1",
                    gpt_image_params
                )
                gpt_image = await gpt_image_poller.result()
                logger.info("GPT-Image-1 deployment created.")
            except Exception as e:
                logger.error(f"Failed to create GPT-Image-1 deployment: {str(e)}")
                raise Exception(f"GPT-Image-1 deployment failed: {str(e)}")
        else:
            logger.warning(f"GPT-Image-1 is not available in the region '{location}'. Skipping deployment.")

        # 4. Create vector search components (unchanged)
        try:
            logger.info("Creating vector search components...")
            vector_index_params = {
                "kind": "vector",
                "properties": {
                    "vector": {
                        "dimensions": 1536,
                        "similarity": "cosine",
                        "hnsw_parameters": {
                            "m": 16,
                            "ef_construction": 128
                        }
                    }
                }
            }
            vector_index_poller = await openai_client.indexes.begin_create_or_update(
                resource_group,
                resource_name,
                "vector-index",
                vector_index_params
            )
            vector_index = await vector_index_poller.result()
            logger.info("Vector index created.")
        except Exception as e:
            logger.error(f"Failed to create vector index: {str(e)}")
            raise Exception(f"Vector index creation failed: {str(e)}")

        # 5. Get API keys
        try:
            logger.info("Retrieving API keys...")
            keys = await openai_client.open_ai_resources.list_keys(resource_group, resource_name)
            
            config = {
                "OPENAI_API_BASE": f"https://{resource_name}.cognitiveservices.azure.com/openai/deployments/gpt-4.1-mini/chat/completions?api-version=2025-01-01-preview",
                "OPENAI_API_KEY": keys.key1,
                "OPENAI_DEPLOYMENT_NAME": "gpt-4.1-mini",
                "OPENAI_API_VERSION": "2023-05-15",
                "VECTOR_SEARCH_KEY": keys.key1,
                "VECTOR_SEARCH_INDEX": vector_index,
                "GPT_IMAGE_API_BASE": f"https://{resource_name}.cognitiveservices.azure.com/openai/deployments/gpt-image-1/images" if location.lower() == "uaenorth" else None,
                "GPT_IMAGE_API_KEY": keys.key1 if location.lower() == "uaenorth" else None,
                "GPT_IMAGE_DEPLOYMENT_NAME": "gpt-image-1" if location.lower() == "uaenorth" else None,
                "GPT_IMAGE_API_VERSION": "2025-04-01-preview" if location.lower() == "uaenorth" else None
            }
            logger.info("Successfully retrieved API keys and configuration.")
        except Exception as e:
            logger.error(f"Failed to retrieve API keys: {str(e)}")
            raise Exception(f"API key retrieval failed: {str(e)}")

        return config

    except Exception as e:
        logger.error(f"Critical error in OpenAI resource creation: {str(e)}")
        # Attempt cleanup if possible
        try:
            logger.warning("Attempting to clean up partially created resources...")
            await openai_client.open_ai_resources.begin_delete(resource_group, resource_name)
            logger.warning("Cleanup attempted for OpenAI resources.")
        except Exception as cleanup_error:
            logger.error(f"Cleanup failed: {str(cleanup_error)}")
        
        raise Exception(f"OpenAI resource creation failed completely: {str(e)}")
    
async def get_openai_quota_and_usage(credentials, subscription_id, location):
    """
    Checks quota and usage for Azure OpenAI resource in the specified location (region).

    Returns a dict of quota, current usage, and limits per SKU or resource type.
    """
    try:
        cognitive_client = CognitiveServicesManagementClient(credentials, subscription_id)

        # List resource SKUs for Cognitive Services in the location
        skus = cognitive_client.resource_skus.list()
        relevant_skus = [sku for sku in skus if sku.resource_type == "accounts" and sku.locations and location in sku.locations]

        # Fetch usage (quotas) for Cognitive Services in the location
        usage_list = cognitive_client.usages.list(location)

        # Filter usage for OpenAI or relevant SKUs
        openai_usages = []
        for usage in usage_list.value:
            # usage.name.value might identify the quota metric, e.g. "OpenAIUnits", etc.
            openai_usages.append({
                "name": usage.name.value,
                "current_value": usage.current_value,
                "limit": usage.limit,
                "unit": usage.unit
            })

        logger.info(f"Retrieved OpenAI quota and usage in {location}")

        return {
            "skus_available": [sku.name for sku in relevant_skus],
            "usage": openai_usages
        }

    except Exception as e:
        logger.error(f"Failed to get OpenAI quota and usage: {str(e)}")
        raise

async def check_vm_quota_and_usage(compute_client, location):
    """
    Check VM quotas in the given location (region).
    Returns a list of usage records with current usage and limits.
    """
    usage_list = compute_client.usage.list(location)
    quota_info = []
    for usage in usage_list:
        quota_info.append({
            "name": usage.name.value,
            "current_value": usage.current_value,
            "limit": usage.limit,
            "unit": usage.unit
        })
    return quota_info

async def check_storage_quota_and_usage(storage_client, location):
    """
    Check Storage account quotas and usage in the given location (region).
    Returns list of usage records.
    """
    usage_list = storage_client.usage.list(location)
    quota_info = []
    for usage in usage_list:
        quota_info.append({
            "name": usage.name.value,
            "current_value": usage.current_value,
            "limit": usage.limit,
            "unit": usage.unit
        })
    return quota_info

async def check_network_quota_and_usage(network_client, location):
    """
    Check Network resource quotas in the given location.
    Returns list of usage records.
    """
    usage_list = network_client.usage.list(location)
    quota_info = []
    for usage in usage_list:
        quota_info.append({
            "name": usage.name.value,
            "current_value": usage.current_value,
            "limit": usage.limit,
            "unit": usage.unit
        })
    return quota_info


def check_azure_dns_configuration(domain_name: str) -> bool:
    """
    Check if a domain is properly configured to use Azure DNS nameservers.
    
    Args:
        domain_name: The domain to check (e.g., 'example.com')
        
    Returns:
        bool: True if all nameservers are Azure DNS servers, False otherwise
    """
    # Azure DNS nameserver suffixes (all regions)
    azure_ns_suffixes = [
        'azure-dns.com',
        'azure-dns.net',
        'azure-dns.org',
        'azure-dns.info'
    ]
    
    try:
        # Get the nameservers for the domain
        answers = dns.resolver.resolve(domain_name, 'NS')
        ns_servers = [str(ns).lower() for ns in answers]
        
        # Check if all nameservers are Azure DNS servers
        all_azure = True
        for ns in ns_servers:
            if not any(ns.endswith(suffix) for suffix in azure_ns_suffixes):
                all_azure = False
                break
                
        return all_azure and len(ns_servers) > 0
        
    except dns.resolver.NoAnswer:
        logger.error(f"No nameservers found for domain {domain_name}")
        return False
    except dns.resolver.NXDOMAIN:
        logger.error(f"Domain {domain_name} does not exist")
        return False
    except Exception as e:
        logger.error(f"DNS lookup failed for {domain_name}: {str(e)}")
        return False
    
# Error handler function
def log_err(error):
    logger.error(error)
    return {"body": json.dumps({"error": error}), "headers": {'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'}, "statusCode": 400,
            "isBase64Encoded": "false"}

# Success handler function
def success(result):
    return {'body': json.dumps({"result": result}), 'headers': {'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'}, 'statusCode': 200,
            'isBase64Encoded': 'false'}
