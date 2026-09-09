#!/bin/bash
# Build OPUS and push it to the EC2 app instance (via S3 + SSM).
# Run from a Mac that already has aws cli configured.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
source "$ROOT/infra/aws/resources.env"
REGION="${REGION:-us-east-1}"
ALB_URL="http://${ALB_DNS}"
STAGE="/tmp/opus-fyp-stage"
TAR="/tmp/opus-fyp-deploy.tgz"
S3_KEY="deploy/opus-fyp-deploy.tgz"

echo "1) Building client for ${ALB_URL}"
cd "$ROOT/client"
npm install
VITE_API_URL="$ALB_URL" npm run build

echo "2) Staging files (no docs, tests, or node_modules)"
rm -rf "$STAGE"
mkdir -p "$STAGE"
rsync -a \
  --exclude node_modules \
  --exclude .git \
  --exclude docs \
  --exclude wordpress-site \
  --exclude 'API IMAGES-FYP' \
  --exclude infra \
  --exclude mern-test \
  --exclude env-test \
  --exclude coverage \
  --exclude .vite \
  --exclude '**/*.log' \
  --exclude 'server/tests' \
  "$ROOT/server" "$ROOT/client" "$ROOT/package.json" "$STAGE/"

# Drop client source after build; keep dist
rm -rf "$STAGE/client/src" "$STAGE/client/public" 2>/dev/null || true
cp "$ROOT/server/.env" "$STAGE/server/.env"

python3 - <<PY
from pathlib import Path
p = Path("$STAGE/server/.env")
lines = p.read_text().splitlines()
kv = {}
order = []
for line in lines:
    if not line.strip() or line.strip().startswith("#") or "=" not in line:
        continue
    k, v = line.split("=", 1)
    if k not in kv:
        order.append(k)
    kv[k] = v
kv["PORT"] = "5001"
kv["CLIENT_URL"] = "$ALB_URL"
kv["SERVE_CLIENT"] = "true"
kv["EMAIL_DEV_FALLBACK"] = "false"
out = [f"{k}={kv[k]}" for k in order]
for k, v in kv.items():
    if k not in order:
        out.append(f"{k}={v}")
p.write_text("\n".join(out) + "\n")
PY

echo "3) Creating archive"
tar -C "$STAGE" -czf "$TAR" .
ls -lh "$TAR"

echo "4) Uploading to s3://${BUCKET}/${S3_KEY}"
aws s3 cp "$TAR" "s3://${BUCKET}/${S3_KEY}" --region "$REGION"

echo "5) Installing on EC2 over SSM"
PRESIGN=$(aws s3 presign "s3://${BUCKET}/${S3_KEY}" --expires-in 3600 --region "$REGION")
REMOTE_SCRIPT="/tmp/opus-remote-install.sh"
cat > "$REMOTE_SCRIPT" <<REMOTE
set -e
dnf install -y nodejs tar gzip curl 2>/dev/null || true
systemctl stop opus-health.service 2>/dev/null || true
systemctl disable opus-health.service 2>/dev/null || true
mkdir -p /opt/opus
curl -fsSL "$PRESIGN" -o /tmp/opus-fyp-deploy.tgz
rm -rf /opt/opus/app
mkdir -p /opt/opus/app
tar -xzf /tmp/opus-fyp-deploy.tgz -C /opt/opus/app
cd /opt/opus/app/server
npm install --omit=dev
cat > /etc/systemd/system/opus.service <<'EOF'
[Unit]
Description=OPUS FYP API
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/opus/app/server
Environment=NODE_ENV=production
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5
User=root

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now opus.service
sleep 8
systemctl --no-pager -l status opus.service || true
curl -sS http://127.0.0.1:5001/api/health || true
echo
REMOTE

B64=$(base64 < "$REMOTE_SCRIPT" | tr -d '\n')
CMD_ID=$(aws ssm send-command \
  --instance-ids "$INSTANCE_ID" \
  --document-name "AWS-RunShellScript" \
  --comment "Deploy OPUS FYP" \
  --parameters "{\"commands\":[\"echo $B64 | base64 -d > /tmp/opus-remote-install.sh\",\"bash /tmp/opus-remote-install.sh\"]}" \
  --region "$REGION" \
  --query 'Command.CommandId' --output text)

echo "SSM CommandId=$CMD_ID"
echo "Waiting for install..."
aws ssm wait command-executed --command-id "$CMD_ID" --instance-id "$INSTANCE_ID" --region "$REGION" || true
aws ssm get-command-invocation \
  --command-id "$CMD_ID" \
  --instance-id "$INSTANCE_ID" \
  --region "$REGION" \
  --query '{Status:Status,Stdout:StandardOutputContent,Stderr:StandardErrorContent}' \
  --output json

echo "6) Updating ALB health check to /api/health"
aws elbv2 modify-target-group \
  --target-group-arn "$TG_ARN" \
  --health-check-path /api/health \
  --region "$REGION" >/dev/null

echo "Done. Open: ${ALB_URL}"
