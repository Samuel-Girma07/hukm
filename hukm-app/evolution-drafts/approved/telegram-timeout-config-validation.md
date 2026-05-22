# Evolution Proposal: Document that Telegram timeout errors may be caused by legacy config keys rather than actual timeouts

- Proposal-ID: evo-2026-05-22-telegram-config-validation
- Status: approved
- Signature: telegram-timeout-config-validation
- Created-At: 2026-05-22 11:07
- Last-Seen-At: 2026-05-22 11:07
- Target-File: MEMORY.md
- Trigger-Type: preference
- Confidence: medium

## Why This Matters
- Document that Telegram timeout errors may be caused by legacy config keys rather than actual timeouts

## Evidence
- Interactive proposal card was present in the session UI.
- The original pending draft file was unavailable at approval time.
- AutoClaw reconstructed this draft from the proposal payload so the review result can still be recorded.

## Duplicate Check
- Checked: pending draft path + signature/proposal fallback
- Result: original draft file missing
- Decision: create surrogate draft from proposal payload

## Proposed Change
### Telegram Config Troubleshooting

## Telegram Timeout Errors

When users report timeout errors on Telegram, check for **config validation failures** before assuming it's a model timeout issue.

### Legacy Key Issue
The `blockStreaming` key in `channels.telegram.accounts.<id>.blockStreaming` is a **legacy config key** that causes validation errors in newer OpenClaw versions. This prevents the gateway from starting properly, resulting in timeout errors when sending messages.

### Diagnosis Steps
1. Check `agents.defaults.timeoutSeconds` — if it's already high (e.g., 1800), the timeout is likely not the real issue
2. Look for gateway config validation errors in logs
3. Check for legacy keys like `blockStreaming`, `streamMode`, or `streaming` in Telegram account config

### Fix
Use `gateway config.patch` to remove invalid keys:
```json
{
  "channels": {
    "telegram": {
      "accounts": {
        "<account-id>": {
          "blockStreaming": null
        }
      }
    }
  }
}
```

Then restart the gateway.

## Apply Plan
1. Keep this reconstructed draft as the approval artifact.
2. Record the proposal content exactly as shown in the interactive card.
3. Append an audit note after approval or rejection.

## User Approval
- Approve: 批准 evo-2026-05-22-telegram-config-validation
- Reject: 拒绝 evo-2026-05-22-telegram-config-validation