# Pull Request

## Description

Brief description of changes.

## Type of Change

- [ ] New feature
- [ ] Bug fix
- [ ] Infrastructure change
- [ ] Documentation update

## File Size Verification

**CRITICAL: All files must be under 500 lines**

```bash
# Run this before submitting PR
npm run lint:file-size
```

- [ ] Verified all files under 500 lines
- [ ] Ran `npm run lint:file-size` successfully
- [ ] Largest file size: ___ lines (must be < 500)

## Changes Made

List key files changed and why.

## Testing

- [ ] Local testing completed
- [ ] Integration tests pass
- [ ] Deployed to dev environment
- [ ] Health checks pass

## Security Checklist

- [ ] No hardcoded secrets
- [ ] Input validation added for new endpoints
- [ ] SQL queries use parameterized inputs
- [ ] JWT validation on authenticated endpoints
- [ ] Security headers configured

## Documentation

- [ ] Updated relevant markdown files
- [ ] Added AWS documentation citations
- [ ] Updated ARCHITECTURE.md if architecture changed
- [ ] Updated README.md if user-facing changes

## AWS Best Practices

- [ ] Follows least-privilege IAM
- [ ] Uses VPC endpoints (no NAT Gateway)
- [ ] Encryption configured
- [ ] CloudWatch metrics/alarms added
- [ ] All AWS claims have documentation links

## Code Quality

- [ ] TypeScript strict mode passes
- [ ] ESLint passes (no warnings)
- [ ] No `any` types used
- [ ] Factory pattern used where appropriate
- [ ] Clear interfaces defined

## Reviewer Checklist

- [ ] All files under 500 lines
- [ ] Code follows existing patterns
- [ ] Security controls maintained
- [ ] AWS documentation cited
- [ ] Tests adequate
- [ ] Documentation updated
