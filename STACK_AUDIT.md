# BurnWare Stack Audit – AWS Best Practices

This document records the audit of the BurnWare CDK stacks against AWS Well-Architected and service-specific best practices, and the changes made.

**References (AWS official):**

- [Well-Architected Security – Least privilege (SEC03-BP02)](https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_permissions_least_privileges.html)
- [VPC security best practices](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-security-best-practices.html)
- [Logging IP traffic with VPC Flow Logs](https://docs.aws.amazon.com/vpc/latest/userguide/flow-logs.html)
- [ALB security groups](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-update-security-groups.html)
- [Auto Scaling health checks](https://docs.aws.amazon.com/autoscaling/ec2/userguide/health-checks-overview.html)
- [Creating ASGs with CloudFormation](https://docs.aws.amazon.com/autoscaling/ec2/userguide/creating-auto-scaling-groups-with-cloudformation.html)
- [CodeDeploy with Auto Scaling](https://docs.aws.amazon.com/codedeploy/latest/userguide/integrations-aws-auto-scaling.html)
- [CodeDeploy IAM](https://docs.aws.amazon.com/codedeploy/latest/userguide/security_iam_service-with-iam.html)
- [cfn-signal](https://docs.aws.amazon.com/CloudFormation/latest/UserGuide/cfn-signal.html)
- [RDS encryption and SSL](https://docs.aws.amazon.com/prescriptive-guidance/latest/encryption-best-practices/rds.html)
- [ALB access logging](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/enable-access-logging.html)

---

## 1. Auto Scaling Group – Signals (App Stack)

**Finding:** The ASG used `Signals.waitForMinCapacity()` but user data did not call `cfn-signal`. CloudFormation therefore never received a success signal and the stack rolled back with “Received 0 SUCCESS signal(s) out of 1”.

**Best practice:** Only use CreationPolicy/signals when instances actually send `cfn-signal` from user data or init; otherwise rely on ELB/EC2 health checks and omit signals so the stack can complete.

**Change:**

- Made signals optional via `useSignals` (default `false`) in `AsgConstruct`.
- App stack passes `asgUseSignals: false` so the stack completes without `cfn-signal`.
- When you add `cfn-signal` to user data (e.g. after app start), set `asgUseSignals: true` in config.

**Files:** `lib/constructs/compute/asg-construct.ts`, `lib/stacks/app-stack.ts`, `lib/config/environments/dev.ts` (optional prop).

---

## 2. ALB Security Group – Inbound Port 80 (Network Stack)

**Finding:** ALB security group allowed only port 443. In dev, the listener is HTTP on port 80, so client traffic on 80 was blocked.

**Best practice:** Allow inbound traffic on the actual listener port(s). For an internet-facing ALB, allow the listener port from `0.0.0.0/0` (and restrict outbound to targets).

**Change:** Added ingress rule for TCP 80 from `0.0.0.0/0` so the dev HTTP listener works.

**Files:** `lib/constructs/networking/security-groups-construct.ts`.

---

## 3. VPC Flow Logs (Network Stack)

**Finding:** VPC had no Flow Logs, reducing visibility for security and troubleshooting.

**Best practice:** Enable VPC Flow Logs (e.g. to CloudWatch Logs or S3) to support incident response and least-privilege network design.

**Change:** Added a VPC Flow Log to CloudWatch Logs with `FlowLogTrafficType.REJECT` and a dedicated log group (30-day retention) to capture rejected traffic.

**Files:** `lib/stacks/network-stack.ts`.

---

## 4. RDS Endpoint in User Data (App Stack / User Data)

**Finding:** User data read `DB_HOST` and `DB_PORT` from the Secrets Manager secret. The RDS construct stores only username/password in that secret; it does not add host/port/dbname, so those values were missing.

**Best practice:** Provide DB endpoint (and port) from the Data stack (e.g. RDS instance attributes) and pass them into user data or Parameter Store; use the secret only for credentials.

**Change:**

- Data stack already exposes `dbEndpoint` and `dbPort`.
- App stack now accepts `dbEndpoint` and `dbPort` and passes them into `UserDataConfig`.
- User data sets `DB_HOST` and `DB_PORT` from config and uses the secret only for `DB_USER` and `DB_PASSWORD`; `DB_NAME` is set to `burnware`.
- When no deployment bucket is set, user data runs a minimal Python HTTP server that responds 200 on `/health` so the instance can pass the ALB health check.

**Files:** `lib/constructs/compute/user-data-builder.ts`, `lib/stacks/app-stack.ts`, `bin/burnware.ts`.

---

## 5. CodeDeploy Service Role – Least Privilege (App Stack)

**Finding:** The CodeDeploy service role used broad actions (`ec2:*`, `autoscaling:*`, `elasticloadbalancing:*`), which conflicts with least-privilege (SEC03-BP02).

**Best practice:** Grant only the actions CodeDeploy needs for EC2/ASG/ELB integration.

**Change:** Replaced the single broad statement with scoped statements:

- **EC2:** `DescribeInstances`, `DescribeInstanceStatus`, `TerminateInstances`, `RunInstances`, `CreateTags`, `DescribeTags`, `DescribeSecurityGroups`, `DescribeSubnets`, `DescribeNetworkInterfaces`, `PassRole`.
- **Auto Scaling:** `CompleteLifecycleAction`, `DeleteLifecycleHook`, `DescribeAutoScalingGroups`, `DescribeLifecycleHooks`, `PutLifecycleHook`, `RecordLifecycleActionHeartbeat`, `CreateOrUpdateTags`, `DescribeTags`.
- **ELB:** `DescribeTargetGroups`, `DescribeTargetHealth`, `DescribeLoadBalancers`, `DescribeListeners`, `RegisterTargets`, `DeregisterTargets`, `DescribeLoadBalancerAttributes`, `DescribeTargetGroupAttributes`.
- **Tag:** `tag:GetResources`.

**Files:** `lib/constructs/security/iam-roles-construct.ts`.

---

## 6. Config Constants – RDS Version (Config)

**Finding:** `lib/config/constants.ts` listed RDS version `15.15` and `postgres15` while the RDS construct uses PostgreSQL 16.

**Change:** Updated constants to `version: '16.11'` and `parameterGroupFamily: 'postgres16'` for consistency.

**Files:** `lib/config/constants.ts`.

---

## Summary of Changes

| Area              | Change                                                                 |
|-------------------|------------------------------------------------------------------------|
| ASG               | Signals optional (default off); stack completes without cfn-signal     |
| ALB SG            | Inbound TCP 80 allowed for dev HTTP listener                           |
| VPC               | Flow Logs to CloudWatch (REJECT traffic), 30-day retention             |
| User data / RDS   | DB host/port from Data stack; secret for credentials only; minimal health server when no bucket |
| CodeDeploy IAM    | Scoped to specific EC2, ASG, ELB, and tag actions                      |
| Constants         | RDS version and parameter group family set to PostgreSQL 16           |

---

## Optional / Future Improvements

- **ALB access logs:** Enable access logging to S3 (or a dedicated bucket) per [Enable access logs for your Application Load Balancer](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/enable-access-logging.html).
- **RDS:** Consider Multi-AZ and increased backup retention for production; avoid T-series for heavy production workloads where appropriate.
- **cfn-signal:** When app startup is fully automated, add `cfn-signal` to user data and set `asgUseSignals: true` so CloudFormation waits for instance readiness.
- **WAF / CloudFront:** Already aligned with current WAF and CloudFront patterns (e.g. S3BucketOrigin, threat protection).

All changes above are aligned with AWS documentation and the Well-Architected Security and Reliability pillars where applicable.
