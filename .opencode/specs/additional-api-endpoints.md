Extend the existing broker data synchronization process to support two additional OMS API endpoints, following the same implementation pattern as the current `EXTERNAL_API_BASE_URL`.

## Additional API Endpoints

### 1. Secondary OMS API

```text
https://prod-oms-api-11.xfltrade.com:20121
```

* Use the same authentication credentials as the existing API:

  * `AUTO_AUTH_USERNAME`
  * `AUTO_AUTH_PASSWORD`

### 2. PUJI OMS API

```text
https://puji.fcslbd.com:20121
```

Use the following dedicated credentials:

```text
AUTO_AUTH_USERNAME=fcs_xfl_broker_trade_api
AUTO_AUTH_PASSWORD=Bsanjana#0521#
```

## Requirements

### API Configuration

* Store all API URLs and credentials in the `.env` file.
* Do not hardcode URLs, usernames, or passwords in the source code.
* Create separate environment variables for each API endpoint and its credentials.

### Data Fetching

* Fetch broker data from all configured API endpoints using the existing synchronization mechanism.
* Ensure that a failure in one API does not prevent processing data from the remaining APIs.
* Implement proper logging and error handling for each API call.

### Database Insert/Update

Before inserting data into the database:

* Check for duplicate records based on the appropriate business key(s) (for example: broker ID, trade date, instrument, or other unique identifiers defined by the existing schema).
* Avoid inserting duplicate data.
* Use an upsert mechanism (`INSERT ... ON CONFLICT`, `MERGE`, or equivalent) wherever applicable.
* Ensure that concurrent executions do not create duplicate records.

### Security Requirements

* Keep all credentials in environment variables only.
* Do not expose credentials in logs, exceptions, or API responses.
* Use parameterized queries or ORM methods to prevent SQL injection.
* Validate and sanitize all incoming data before persisting it.
* Handle authentication failures and token expiration securely.
* Ensure database operations are performed within transactions where appropriate.

### Additional Requirements

* Maintain backward compatibility with the existing codebase.
* Keep the implementation modular and reusable so that additional OMS endpoints can be added easily in the future.
* Add comprehensive logging for:

  * Authentication success/failure
  * API call success/failure
  * Duplicate detection
  * Insert/update operations
  * Synchronization summary per API endpoint
