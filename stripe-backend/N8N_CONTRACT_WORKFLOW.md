# n8n Contract Workflow

When a customer signs the contract on the website, the backend sends the signed packet data to n8n via webhook.

## Setup in Backend

Set these env vars on your production server (104.236.245.168):

```env
CONTRACT_WEBHOOK_URL=https://api.usevetra.com/webhook/vetra-contract-intake
CONTRACT_WEBHOOK_SECRET=your-secret-key-here
```

The backend will POST contract data to that webhook URL with this header:
```
x-contract-webhook-secret: your-secret-key-here
```

## n8n Workflow Steps

### 1. Webhook Trigger
- **Name:** Webhook
- **Method:** POST
- **Path:** `/webhook/vetra-contract-intake`
- **Response mode:** Using Respond to Webhook Node
- **Authentication:** None (optional—you'll manually verify with IF node below)

### 2. Security Check
- **Name:** IF
- **Condition:** Verify the secret header to ensure only your backend is posting
- **Left value:** `{{ $json.headers["x-contract-webhook-secret"] || "" }}`
- **Operator:** equals
- **Right value:** `your-secret-key-here` (must match backend env var)
- **If True:** continue
- **If False:** respond with error

### 3. Extract & Transform
- **Name:** Set
- **Keep fields from payload:**
  - `ts` (timestamp of signing)
  - `packetId` (unique contract ID)
  - `signerEmail`
  - `signerName`
  - `dbaName` (shop/business name)
  - `selectedPlan` (e.g., "12-Month Monthly - $199/mo")
  - `packetText` (full contract text as signed)
  - `packetSha256` (integrity hash)
  - `ip`
  - `userAgent`

### 4. Save Contract to Google Drive (or your docs system)
- **Name:** Google Drive
- **Operation:** Upload File
- **File Name Expression:**
  ```
  {{ "VETRA-" + $json.packetId + "-" + ($json.signerName || "unsigned").replace(/[^a-zA-Z0-9]/g, "-") + ".txt" }}
  ```
- **File Content:** `{{ $json.packetText }}`
- **Folder ID:** [select your contracts folder]

### 5. Log to Google Sheets (Optional)
- **Name:** Google Sheets
- **Operation:** Append Row
- **Sheet:** Create a "Contracts" sheet with columns:
  - Timestamp | Signer Email | Signer Name | Shop Name | Plan | Packet ID | File Link | IP | Date Signed
- **Append values from payload**

### 6. Notify (Optional)
- **Name:** Gmail / Slack / Email
- **To:** Your email or Slack channel
- **Subject:** `New Contract Signed - {{ $json.dbaName }}`
- **Body:** Include signer, shop, plan, and link to saved file

### 7. Send Success Response
- **Name:** Respond to Webhook
- **Status Code:** `200`
- **Response Body:**
  ```json
  {"ok": true}
  ```

## Incoming Webhook Payload

```json
{
  "packetId": "VETRA-1711270800000-12345",
  "ts": "2026-03-23T14:00:00.000Z",
  "signerEmail": "owner@shopname.com",
  "signerName": "John Smith",
  "legalName": "Smith Auto Repair LLC",
  "dbaName": "Smith Auto",
  "selectedPlan": "12-Month Monthly - $199/mo",
  "source": "website-checkout",
  "packetSha256": "abc123def...",
  "packetText": "VETRA CONTRACT SIGNATURE PACKET\n...",
  "ip": "203.0.113.5",
  "userAgent": "Mozilla/5.0..."
}
```

## Minimal Viable Setup

If you want fastest deployment:
1. Webhook (trigger)
2. IF (verify secret)
3. Google Drive (save file)
4. Respond to Webhook (success response)

That's it. This gives you contract archival with zero email dependencies.
