# Azure AI Chat Assistant Deployment

One-click deployment of a fully automated AI chat assistant with GPT-4.1-mini and GPT-image-1 image generation capabilities.

[🌐 LEARN MORE](https://azure-ai-assistant.netlify.app/)

## Contributors

This project exists thanks to all the people who contribute.  
<a href="https://opencollective.com/songdropnet">
<img src="https://opencollective.com/songdropnet/contributors.svg?width=890&button=false" alt="Contributors" />
</a>

## Backers

Thank you to all our backers! 🙏  
<a href="https://opencollective.com/songdropnet/projects/gitgptchat#backers" target="_blank">
<img src="https://opencollective.com/songdropnet/projects/gitgptchat/backers.svg?width=890" alt="Backers" />
</a>  
[Become a backer](https://opencollective.com/songdropnet/projects/gitgptchat#backer)

---

```
#Dockerfile
docker build -t gpt-app .
docker run -d --name gpt-container -p 3000:3000 -p 8000:8000 gpt-app
```

 

```
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"
export NODE_OPTIONS=--openssl-legacy-provider
node -v
npm -v
chmod +x install.sh
./install.sh

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"
export NODE_OPTIONS=--openssl-legacy-provider
node -v
npm -v
chmod +x restart_services.sh
./restart_services.sh
```

```
python3.10 -m venv myenv
source myenv/bin/activate
pip install -r requirements.txt
python3.10 create_vm.py

python3.10 -m venv myenv
source myenv/bin/activate
python3.10 delete_vm.py
```

## High-Level Overview

This solution automates the creation, configuration, and deployment of an AI chat assistant application on Azure with advanced vector search capabilities.

### Key Features

- Automated Azure resource provisioning with quota checks
- Azure OpenAI service deployments: GPT-4.1-mini (chat) and GPT-image-1 (image generation)
- Azure File upload storage for vector database embedding
- Azure OpenAI vector search database integration
- Secure networking setup: Virtual Network (VNet), Network Security Group (NSG), and Public IP
- Automated Ubuntu VM setup via Custom Script Extension
- DNS configuration with Azure DNS
- SSL certificates via Let's Encrypt with certbot
- Built-in logging and monitoring readiness
- Code translator supporting multiple languages

---

## Prerequisites

Before deploying, ensure you have the following:

- **Azure Portal Account**  
  [https://portal.azure.com](https://portal.azure.com)  
  Active subscription with sufficient quotas.

- **Domain Name**  
  Purchase from Namecheap or another registrar (e.g., `yourdomain.com`).

- **DNS Configuration**  
  Point your domain's nameservers to Azure DNS:

  ```
  ns1-03.azure-dns.com
  ns2-03.azure-dns.net
  ns3-03.azure-dns.org
  ns4-03.azure-dns.info
  ```

- **Service Principal**  
  Azure AD application with Contributor permissions, with these environment variables:

  - `AZURE_CLIENT_ID`
  - `AZURE_CLIENT_SECRET`
  - `AZURE_TENANT_ID`

- **Azure CLI**  
  Installed and authenticated for manual deployment.

---

## Solution Architecture

The deployment provisions and configures:

- **Compute**  
  Ubuntu 22.04 LTS Virtual Machine with custom script extension and SSL setup.

- **AI Services**  
  Azure OpenAI resource with GPT-4.1-mini (chat) and GPT-image-1 (image gen) deployments.

- **Vector Search Database**  
  Azure OpenAI vector search database for custom large language model (LLM)-ready vector indexing.

- **Storage**  
  Azure Blob Storage container for scripts and file uploads.

- **Networking**  
  Virtual Network, Public IP, Network Security Group with inbound rules (ports 22, 80, 443, 8000).

- **DNS**  
  Azure DNS zone configured for your domain with A record pointing to the VM.

---

## Detailed Deployment Process

1. **Authentication**  
   Uses `ClientSecretCredential` to authenticate with Azure using service principal credentials.

2. **Quota Checks**  
   Verifies quotas for OpenAI service usage, VM vCPU cores, storage, and network resources.

3. **Resource Group & Storage**  
   Creates/updates Azure Resource Group and Storage Account (Standard_LRS, StorageV2).

4. **Azure Container Storage**  
   Creates container for file uploads to enable vector database embedding.

5. **Azure OpenAI Resource & Deployments**  
   Deploys Azure OpenAI resource with SKU `S0` and two deployments:

   - `gpt-4.1-mini` (chat/completions)
   - `gpt-image-1` (image generation)

6. **Setup Script Generation**  
   Generates a bash setup script run on the VM after provisioning to install dependencies and configure the app.

7. **Networking Setup**  
   Creates Virtual Network, subnet, Public IP, Network Security Group with inbound rules.

8. **Virtual Machine Creation**  
   Provisions Ubuntu 22.04 LTS VM with network interface.

9. **DNS Setup**  
   Creates or updates Azure DNS zone and adds A record pointing to VM's public IP.

10. **VM Custom Script Extension**  
    Attaches script extension to download and execute setup script from Blob Storage.

---

## Deployment Options

### One-Click Deployment

Click the button below to start the deployment:

[![Deploy to Azure](https://aka.ms/deploytoazurebutton)](https://azure-ai-assistant.netlify.app/)

> _Note: Requires Azure subscription with appropriate permissions and service principal credentials._

### Manual Deployment

1. Install and authenticate Azure CLI.
2. Clone this repository.
3. Configure environment variables in `.env` file:
   ```
   AZURE_CLIENT_ID=your_client_id
   AZURE_CLIENT_SECRET=your_client_secret
   AZURE_TENANT_ID=your_tenant_id
   ```
4. Run the deployment script:
   ```bash
   ./deploy.sh
   ```

---

## Use Cases

- Deploy scalable AI chat assistants on Azure OpenAI.
- Applications requiring integrated text and image generation.
- Solutions leveraging vector search for contextual AI responses.
- Projects needing fully automated infrastructure provisioning.

---

## License & Credits

MIT License
Azure AI Chat Assistant Deployment Template | © 2025 Gabriel Majorsky

---

## Links

- [Official Deployment Site](https://azure-ai-assistant.netlify.app/)
- [Azure Portal](https://portal.azure.com)
- [Azure OpenAI Documentation](https://learn.microsoft.com/en-us/azure/cognitive-services/openai/)

- [Display GitHub contributors](https://remarkablemark.org/blog/2019/10/17/github-contributors-readme/)

---

_For questions or support, please open an issue or contact the maintainer._
