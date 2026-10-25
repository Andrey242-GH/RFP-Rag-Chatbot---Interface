# Install Terraform and AWS CLI in GitHub Codespaces

These instructions install Terraform and AWS CLI v2 in the current Linux-based Codespace. Open the integrated terminal and run the commands below.

## Install Terraform

Add HashiCorp's official apt repository, then install Terraform:

```bash
sudo apt-get update
sudo apt-get install -y curl gpg

sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://apt.releases.hashicorp.com/gpg \
  | sudo gpg --dearmor -o /etc/apt/keyrings/hashicorp-archive-keyring.gpg
sudo chmod 644 /etc/apt/keyrings/hashicorp-archive-keyring.gpg

echo "deb [signed-by=/etc/apt/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(. /etc/os-release && echo "$VERSION_CODENAME") main" \
  | sudo tee /etc/apt/sources.list.d/hashicorp.list

sudo apt-get update
sudo apt-get install -y terraform
```

Verify the installed version:

```bash
terraform version
```

## Install AWS CLI v2

Install the prerequisites, download the AWS CLI v2 installer for the Codespace's CPU architecture, and run it:

```bash
sudo apt-get update
sudo apt-get install -y curl unzip

case "$(uname -m)" in
  x86_64) AWS_CLI_ARCH=x86_64 ;;
  aarch64|arm64) AWS_CLI_ARCH=aarch64 ;;
  *)
    echo "Unsupported CPU architecture: $(uname -m)" >&2
    exit 1
    ;;
esac

curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-${AWS_CLI_ARCH}.zip" -o awscliv2.zip
unzip -q awscliv2.zip
sudo ./aws/install
rm -rf aws awscliv2.zip
```

Verify the installed version:

```bash
aws --version
```

The output should begin with `aws-cli/2`.

## Optional: check AWS credentials

Checking the CLI version only confirms that it is installed; it does not confirm that AWS credentials are configured. To check the credentials and account available to the CLI, run:

```bash
aws sts get-caller-identity
```

If this reports missing credentials, configure credentials using your organization's approved method. Avoid putting access keys directly in source code or committing them to the repository.

## Keep the tools in rebuilt Codespaces

These commands install the tools in the current Codespace. A rebuild may remove manually installed packages. To make installation repeatable, add Terraform and AWS CLI to the repository's dev container configuration (for example, with Dev Container Features in `.devcontainer/devcontainer.json`) and rebuild the Codespace.
