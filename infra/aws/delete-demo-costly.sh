#!/bin/bash
# Stops billing for NAT + ALB + EC2. Keeps VPC/subnets/S3 so we can recreate later.
# Usage: ./delete-demo-costly.sh

set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
source "$DIR/resources.env"
REGION="${REGION:-us-east-1}"

echo "Deleting ALB listener and load balancer..."
LISTENER_ARN=$(aws elbv2 describe-listeners --load-balancer-arn "$ALB_ARN" --region "$REGION" \
  --query 'Listeners[0].ListenerArn' --output text 2>/dev/null || true)
if [ -n "${LISTENER_ARN:-}" ] && [ "$LISTENER_ARN" != "None" ]; then
  aws elbv2 delete-listener --listener-arn "$LISTENER_ARN" --region "$REGION" || true
fi
aws elbv2 delete-load-balancer --load-balancer-arn "$ALB_ARN" --region "$REGION" || true
echo "Waiting for ALB to delete..."
aws elbv2 wait load-balancers-deleted --load-balancer-arns "$ALB_ARN" --region "$REGION" 2>/dev/null || true

echo "Deleting target group..."
aws elbv2 delete-target-group --target-group-arn "$TG_ARN" --region "$REGION" || true

echo "Terminating EC2..."
aws ec2 terminate-instances --instance-ids "$INSTANCE_ID" --region "$REGION" >/dev/null || true
aws ec2 wait instance-terminated --instance-ids "$INSTANCE_ID" --region "$REGION" || true

echo "Deleting NAT Gateway (this takes a few minutes)..."
aws ec2 delete-nat-gateway --nat-gateway-id "$NAT_ID" --region "$REGION" >/dev/null || true
aws ec2 wait nat-gateway-deleted --nat-gateway-ids "$NAT_ID" --region "$REGION" || true

echo "Releasing Elastic IP..."
aws ec2 release-address --allocation-id "$ALLOC_ID" --region "$REGION" || true

echo "Done. VPC, subnets, security groups, and S3 bucket are still there."
echo "Run recreate-demo.sh on demo day when you need NAT + ALB + EC2 again."
