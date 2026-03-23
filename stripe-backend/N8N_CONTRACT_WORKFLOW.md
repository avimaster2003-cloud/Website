# n8n Contract Workflow

Use this when contract packets are forwarded from the website backend.

## Backend webhook target
Set this backend env var:

```env
CONTRACT_WEBHOOK_URL=https://api.apexconversiongroup.com/webhook/vetra-contract-intake
```

Optional backend auth header:

```env
CONTRACT_WEBHOOK_SECRET=change_me
```

The backend will send this header to n8n if configured:

```text
x-contract-webhook-secret: <your secret>
```

## n8n nodes

1. `Webhook`
- Method: `POST`
- Path: `vetra-contract-intake`
- Response mode: `Using Respond to Webhook Node`

2. `IF`
- Purpose: verify `x-contract-webhook-secret`
- Left value:
  ```text
  {{ $json.headers["x-contract-webhook-secret"] || "" }}
  ```
- Condition: `equals`
- Right value: your chosen secret

3. `Set`
- Keep only the fields you care about:
  - `ts` -> `{{ $json.body.ts }}`
  - `signerEmail` -> `{{ $json.body.signerEmail }}`
  - `signerName` -> `{{ $json.body.signerName }}`
  - `dbaName` -> `{{ $json.body.dbaName }}`
  - `selectedPlan` -> `{{ $json.body.selectedPlan }}`
  - `packetText` -> `{{ $json.body.packetText }}`
  - `ip` -> `{{ $json.body.ip }}`
  - `userAgent` -> `{{ $json.body.userAgent }}`

4. `Google Drive` or `Google Docs`

Option A: easiest archive
- `Google Drive` node
- Operation: upload file
- File name:
  ```text
  {{ "contract-" + ($json.dbaName || "unknown").replace(/\s+/g, "-") + "-" + ($json.ts || Date.now()) + ".txt" }}
  ```
- File content: `{{ $json.packetText }}`

Option B: cleaner deliverable
- `Google Docs` template or document creation flow
- Replace placeholders with signer fields and packet text
- Export to PDF after creation

5. `Google Sheets`
- Append one row to contract log sheet with:
  - `Timestamp`
  - `Signer Email`
  - `Signer Name`
  - `DBA`
  - `Plan`
  - `Saved File Link`
  - `IP`
  - `User Agent`

6. `Gmail` or `Microsoft Outlook`
- To: `legal@apexconversiongroup.com`
- Subject:
  ```text
  New Signed VETRA Contract - {{ $json.dbaName }}
  ```
- Body: include signer details, plan, timestamp, and file link

7. `Respond to Webhook`
- Status code: `200`
- Response body:
  ```json
  {"ok":true}
  ```

## Incoming payload shape
The backend forwards JSON like this:

```json
{
  "ts": "2026-03-23T00:00:00.000Z",
  "signerEmail": "owner@example.com",
  "signerName": "Jane Smith",
  "dbaName": "Smith Auto",
  "selectedPlan": "12-Month Monthly - $199/mo",
  "packetText": "VETRA CONTRACT SIGNATURE PACKET...",
  "ip": "203.0.113.1",
  "userAgent": "Mozilla/5.0 ..."
}
```

## Recommended minimal first version
If you want fastest setup, start with only these nodes:
1. `Webhook`
2. `IF`
3. `Google Drive`
4. `Google Sheets`
5. `Gmail`
6. `Respond to Webhook`

That is enough to store, log, and notify on every signed contract.
