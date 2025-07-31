# Stellar HTLC Makefile
# Production-ready Soroban smart contract build system

.PHONY: help build build-optimized test test-verbose clean fmt check clippy audit deploy deploy-testnet invoke-testnet

# Default network configurations
NETWORK_TESTNET = testnet
NETWORK_MAINNET = mainnet

# Contract paths
CONTRACT_DIR = .
CONTRACT_NAME = stellar-htlc
WASM_TARGET_DIR = target/wasm32-unknown-unknown/release
OPTIMIZED_WASM = $(CONTRACT_NAME)-optimized.wasm

# Stellar CLI configurations  
STELLAR_CLI = soroban
RPC_URL_TESTNET = https://soroban-testnet.stellar.org:443
RPC_URL_MAINNET = https://soroban-mainnet.stellar.org:443

# Help target
help: ## Show this help message
	@echo "Available targets:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

# Development targets
build: ## Build the contract for development
	cargo build --target wasm32-unknown-unknown --release
	@echo "✅ Contract built successfully"

build-optimized: build ## Build optimized contract for production deployment
	@echo "🔧 Optimizing WASM contract..."
	$(STELLAR_CLI) contract optimize --wasm $(WASM_TARGET_DIR)/$(CONTRACT_NAME).wasm
	@echo "✅ Optimized contract created: $(OPTIMIZED_WASM)"

test: ## Run all tests
	cargo test --features testutils

test-verbose: ## Run tests with verbose output
	cargo test --features testutils -- --nocapture

test-coverage: ## Run tests with coverage (requires cargo-tarpaulin)
	cargo tarpaulin --features testutils --out Html --output-dir coverage

# Code quality targets
fmt: ## Format code
	cargo fmt

check: ## Check code without building
	cargo check --target wasm32-unknown-unknown

clippy: ## Run clippy linter
	cargo clippy --target wasm32-unknown-unknown --features testutils -- -D warnings

audit: ## Run security audit
	cargo audit

# Clean targets
clean: ## Clean build artifacts
	cargo clean
	rm -f *.wasm

# Network setup targets
setup-networks: ## Add Stellar networks configuration
	$(STELLAR_CLI) network add testnet --rpc-url $(RPC_URL_TESTNET) --network-passphrase "Test SDF Network ; September 2015"
	$(STELLAR_CLI) network add mainnet --rpc-url $(RPC_URL_MAINNET) --network-passphrase "Public Global Stellar Network ; September 2015"
	@echo "✅ Networks configured"

# Deployment targets
deploy-testnet: build-optimized setup-networks ## Deploy to Stellar testnet
	@echo "🚀 Deploying to testnet..."
	$(STELLAR_CLI) contract deploy \
		--wasm $(OPTIMIZED_WASM) \
		--network $(NETWORK_TESTNET) \
		--source-account $(STELLAR_ACCOUNT)
	@echo "✅ Contract deployed to testnet"

deploy-mainnet: build-optimized setup-networks ## Deploy to Stellar mainnet (requires confirmation)
	@echo "⚠️  WARNING: Deploying to MAINNET. This will use real XLM!"
	@read -p "Are you sure you want to deploy to mainnet? (y/N): " confirm && [ "$$confirm" = "y" ]
	@echo "🚀 Deploying to mainnet..."
	$(STELLAR_CLI) contract deploy \
		--wasm $(OPTIMIZED_WASM) \
		--network $(NETWORK_MAINNET) \
		--source-account $(STELLAR_ACCOUNT)
	@echo "✅ Contract deployed to mainnet"

# Contract interaction examples
invoke-create-htlc: ## Example: Create HTLC on testnet
	$(STELLAR_CLI) contract invoke \
		--id $(CONTRACT_ID) \
		--network $(NETWORK_TESTNET) \
		--source-account $(STELLAR_ACCOUNT) \
		-- create_htlc \
		--sender $(SENDER_ADDRESS) \
		--receiver $(RECEIVER_ADDRESS) \
		--amount 10000000 \
		--hashlock $(HASHLOCK) \
		--timelock $(shell date -d '+1 hour' +%s) \
		--safety_deposit 1000000

invoke-withdraw: ## Example: Withdraw from HTLC on testnet
	$(STELLAR_CLI) contract invoke \
		--id $(CONTRACT_ID) \
		--network $(NETWORK_TESTNET) \
		--source-account $(STELLAR_ACCOUNT) \
		-- withdraw \
		--contract_id $(HTLC_CONTRACT_ID) \
		--preimage $(PREIMAGE)

invoke-refund: ## Example: Refund HTLC on testnet
	$(STELLAR_CLI) contract invoke \
		--id $(CONTRACT_ID) \
		--network $(NETWORK_TESTNET) \
		--source-account $(STELLAR_ACCOUNT) \
		-- refund \
		--contract_id $(HTLC_CONTRACT_ID)

# Development workflow
dev: fmt check clippy test ## Run full development checks

ci: fmt check clippy test audit ## Run CI checks

# Production workflow  
prod-check: build-optimized test audit ## Pre-production validation

# Docker targets (optional)
docker-build: ## Build contract in Docker environment
	docker run --rm -v "$$PWD":/workspace \
		--workdir /workspace \
		stellar/soroban-cli:latest \
		make build-optimized

# Documentation
docs: ## Generate documentation
	cargo doc --no-deps --features testutils

# Size analysis
size-analysis: build-optimized ## Analyze contract size
	@echo "📊 Contract size analysis:"
	@ls -lh $(OPTIMIZED_WASM)
	@echo "Contract size: $$(stat -f%z $(OPTIMIZED_WASM) 2>/dev/null || stat -c%s $(OPTIMIZED_WASM)) bytes"

# Environment validation
validate-env: ## Validate environment setup
	@echo "🔍 Validating environment..."
	@command -v cargo >/dev/null 2>&1 || { echo "❌ cargo not found. Install Rust toolchain."; exit 1; }
	@command -v $(STELLAR_CLI) >/dev/null 2>&1 || { echo "❌ soroban CLI not found. Install Stellar CLI."; exit 1; }
	@rustc --print target-list | grep -q wasm32-unknown-unknown || { echo "❌ wasm32-unknown-unknown target not installed. Run: rustup target add wasm32-unknown-unknown"; exit 1; }
	@echo "✅ Environment validated"

# Quick development cycle
quick: fmt check test ## Quick development cycle (fmt + check + test)

# All quality checks
all-checks: validate-env fmt check clippy test audit size-analysis ## Run all quality checks

# Example usage instructions
usage: ## Show usage examples
	@echo ""
	@echo "🚀 Stellar HTLC Contract Usage Examples:"
	@echo ""
	@echo "Development:"
	@echo "  make dev                    # Run development checks"
	@echo "  make test                   # Run tests"
	@echo "  make build-optimized        # Build for deployment"
	@echo ""
	@echo "Deployment:"
	@echo "  STELLAR_ACCOUNT=<account> make deploy-testnet"
	@echo "  STELLAR_ACCOUNT=<account> make deploy-mainnet"
	@echo ""
	@echo "Contract Interaction:"
	@echo "  CONTRACT_ID=<id> SENDER_ADDRESS=<addr> RECEIVER_ADDRESS=<addr> HASHLOCK=<hash> make invoke-create-htlc"
	@echo "  CONTRACT_ID=<id> HTLC_CONTRACT_ID=<id> PREIMAGE=<preimage> make invoke-withdraw"
	@echo ""