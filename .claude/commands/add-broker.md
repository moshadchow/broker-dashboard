# /project:add-broker

Add a new broker to the static broker list.

## Usage
Run this command and provide: label (display name) and id (XBrokerId value).

## Steps

1. Open `src/config/brokers.ts`
2. Append to the `BROKERS` array:
```ts
{ id: "<NEW_BROKER_ID>", label: "<NEW_LABEL>" },
```
3. Run `npx tsc --noEmit` to confirm no type errors.
4. No other files need changes — the hook iterates `BROKERS` dynamically.

## Example
To add broker "XYZ" with id "abc123xyz":
```ts
export const BROKERS: Broker[] = [
  { id: "68d3b213bc4af8054a7dd843", label: "SNM" },
  { id: "68d3b25510420252a457a4e1", label: "BAL" },
  { id: "68d3b228bc4af8054a7dd85c", label: EBS" }, 
  { id: "698482b3de47c112ec2675aa", label: "FCS" },
  { id: "68d26fbafc08e0d825d20e43", label: "GDF" },
  { id: "698482c1de47c112ec2675c4", label: "IBL" },
  { id: "68d3b23810420252a457a4c6", label: "IBB" },
  { id: "698482ccde47c112ec2675de", label: "MPL" },
  { id: "68d27053fc08e0d825d20e8e", label: "NLS" },
  { id: "68d27024fc08e0d825d20e75", label: "ONE" },
  { id: "6949489d43148d5124c5bffe", label: "REM" },
  { id: "68d3b247bc4af8054a7dd875", label: "SJB" },
  { id: "6930211e371a2699f4df89f6", label: "SKY" },
  { id: "68d26fd0fc08e0d825d20e5c", label: "UBR" },
  { id: "698482d6de47c112ec2675f8", label: "WSL" },

];
```
