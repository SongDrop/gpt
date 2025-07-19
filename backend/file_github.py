import os
import base64
import requests
from typing import List, Dict, Optional, Union
from collections import defaultdict

class GitHubRepoLoader:
    def __init__(self, access_token: str = None):
        self.access_token = access_token
        self.headers = {
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28"
        }
        if access_token:
            self.headers["Authorization"] = f"Bearer {access_token}"

    def get_repo_contents(
        self, 
        owner: str, 
        repo: str, 
        path: str = "", 
        recursive: bool = False
    ) -> List[Dict]:
        """Get contents of a GitHub repository"""
        url = f"https://api.github.com/repos/{owner}/{repo}/contents/{path}"
        params = {}
        if recursive:
            params["recursive"] = "1"
        
        response = requests.get(url, headers=self.headers, params=params)
        response.raise_for_status()
        return response.json()

    def build_file_tree(self, contents: List[Dict]) -> Dict:
        """Build a hierarchical file tree structure"""
        tree = defaultdict(dict)
        
        for item in contents:
            if item["type"] == "dir":
                # Add directory placeholder
                path_parts = item["path"].split("/")
                current_level = tree
                for part in path_parts:
                    if part not in current_level:
                        current_level[part] = {}
                    current_level = current_level[part]
            else:
                # Add file to tree
                path_parts = item["path"].split("/")
                current_level = tree
                for part in path_parts[:-1]:
                    current_level = current_level.setdefault(part, {})
                current_level[path_parts[-1]] = {
                    "type": "file",
                    "size": item["size"],
                    "sha": item["sha"]
                }
        
        return dict(tree)

    def print_file_tree(self, tree: Dict, indent: int = 0) -> None:
        """Print file tree structure with indentation"""
        for name, value in tree.items():
            if isinstance(value, dict) and "type" not in value:
                # It's a directory
                print(" " * indent + f"📁 {name}/")
                self.print_file_tree(value, indent + 4)
            else:
                # It's a file
                file_type = "📄"  # Default for code files
                if name.endswith((".png", ".jpg", ".jpeg", ".gif")):
                    file_type = "🖼️"
                elif name.endswith(".md"):
                    file_type = "📝"
                print(" " * indent + f"{file_type} {name} ({value['size']} bytes)")

    def get_file_content(
        self, 
        owner: str, 
        repo: str, 
        path: str
    ) -> str:
        """Get content of a specific file"""
        url = f"https://api.github.com/repos/{owner}/{repo}/contents/{path}"
        response = requests.get(url, headers=self.headers)
        response.raise_for_status()
        
        content_data = response.json()
        if content_data["encoding"] == "base64":
            return base64.b64decode(content_data["content"]).decode("utf-8")
        return content_data["content"]

    def load_code_files(
        self, 
        owner: str, 
        repo: str, 
        tree: Dict, 
        base_path: str = ""
    ) -> Dict[str, str]:
        """Recursively load code files from the tree"""
        code_files = {}
        
        for name, value in tree.items():
            current_path = f"{base_path}/{name}" if base_path else name
            
            if isinstance(value, dict) and "type" not in value:
                # Directory - recurse
                code_files.update(self.load_code_files(owner, repo, value, current_path))
            else:
                # File - check if it's code
                if self.is_code_file(name):
                    try:
                        content = self.get_file_content(owner, repo, current_path)
                        code_files[current_path] = content
                    except Exception as e:
                        print(f"Error loading {current_path}: {str(e)}")
        
        return code_files

    def is_code_file(self, filename: str) -> bool:
        """Check if a file is a code file (filter out assets, binaries, etc.)"""
        code_extensions = [
            '.py', '.js', '.ts', '.jsx', '.tsx', '.java', '.kt', '.kts', 
            '.c', '.cpp', '.h', '.hpp', '.cs', '.go', '.rs', '.swift', 
            '.php', '.rb', '.scala', '.hs', '.lua', '.pl', '.sh', '.bash',
            '.zsh', '.fish', '.r', '.m', '.sql', '.html', '.css', '.scss',
            '.sass', '.less', '.json', '.yaml', '.yml', '.toml', '.ini', 
            '.cfg', '.conf', '.md', '.txt'
        ]
        
        # Skip large files (>1MB) and hidden files
        if filename.startswith(".") or filename.endswith((".ico", ".svg", ".lock")):
            return False
        
        return any(filename.endswith(ext) for ext in code_extensions)

# Example usage
if __name__ == "__main__":
    # Initialize with your GitHub access token for higher rate limits
    loader = GitHubRepoLoader(access_token="your_github_token")
    
    # Get repository contents
    owner = "owner_name"
    repo = "repo_name"
    contents = loader.get_repo_contents(owner, repo)
    
    # Build and print file tree
    file_tree = loader.build_file_tree(contents)
    print("Repository Structure:")
    loader.print_file_tree(file_tree)
    
    # Load all code files
    print("\nLoading code files...")
    code_files = loader.load_code_files(owner, repo, file_tree)
    
    print(f"\nLoaded {len(code_files)} code files:")
    for path, content in code_files.items():
        print(f"- {path} ({len(content)} characters)")
        # For demo, print first 100 chars of first 3 files
        if list(code_files.keys()).index(path) < 3:
            print("  " + content[:100].replace("\n", " ") + "...")