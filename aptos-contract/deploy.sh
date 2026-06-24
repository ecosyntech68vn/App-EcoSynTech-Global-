#!/usr/bin/env bash
# Deploy FarmOSTrace Move module lên Aptos testnet
# Yêu cầu: aptos CLI (https://aptos.dev/cli)
#
# Cách dùng:
#   chmod +x deploy.sh
#   ./deploy.sh testnet|mainnet
#
# Sau khi deploy, copy module address vào app settings.

set -euo pipefail

NETWORK="${1:-testnet}"
PROFILE="farmos-${NETWORK}"

echo "=== EcoSynTech Farm OS — Deploy Move module lên Aptos ${NETWORK} ==="

# Bước 1: Compile
echo ">>> Compiling Move module..."
aptos move compile \
  --package-dir aptos-contract \
  --named-addresses farmos=_ \
  --save-metadata \
  --skip-fetch-latest-git-deps

# Bước 2: Kiểm tra tài khoản
echo ">>> Kiểm tra tài khoản..."
aptos account list \
  --profile "${PROFILE}" \
  --query balance 2>/dev/null || {
    echo "⚠ Chưa có profile '${PROFILE}'. Tạo tài khoản mới..."
    aptos init \
      --network "${NETWORK}" \
      --profile "${PROFILE}"
  }

# Bước 3: Deploy
echo ">>> Deploying module lên ${NETWORK}..."
aptos move publish \
  --package-dir aptos-contract \
  --named-addresses farmos=_ \
  --profile "${PROFILE}" \
  --assume-yes

# Bước 4: Lấy địa chỉ module
MODULE_ADDR=$(aptos config show-profiles --profile "${PROFILE}" 2>/dev/null | grep account | head -1 | awk '{print $2}')
echo ""
echo "=== DEPLOY HOÀN TẤT ==="
echo "Network:    ${NETWORK}"
echo "Profile:    ${PROFILE}"
echo "Module:     ${MODULE_ADDR}::trace"
echo ""
echo "Nhập địa chỉ này vào app Settings > Aptos Blockchain:"
echo "  Module Address: ${MODULE_ADDR}"
echo ""

# Bước 5: Verify
echo ">>> Xác minh module đã deploy..."
aptos move view \
  --profile "${PROFILE}" \
  --function-id "${MODULE_ADDR}::trace::is_initialized" \
  --args "address:${MODULE_ADDR}" 2>/dev/null && echo "✅ Module deployed thành công!" || echo "⚠ Không thể verify — kiểm tra lại"
