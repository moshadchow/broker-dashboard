The bearer token is expiring after a few minutes.

There are two authentication endpoints available:

- /api/login

  - Request:
    {
      "loginId": "string",
      "password": "string",
      "deviceId": "string",
      "mfaKey": "string",
      "mfaCode": "string",
      "appType": 1
    }

  - Response:
    {
      "lastUpdatedTimeUtc": "2026-06-07T04:41:37.947Z",
      "data": {
        "userId": "string",
        "accessToken": "string",
        "refreshToken": "string",
        "accessTokenExpiryDateTimeUtc": "2026-06-07T04:41:37.947Z",
        "success": true,
        "errorMessage": "string",
        "displayName": "string",
        "email": "string",
        "isAuthorised": true,
        "isAuthenticated": true,
        "serverDateTimeUtc": "2026-06-07T04:41:37.947Z",
        "isMfaRequired": true,
        "mfaKey": "string",
        "passwordChangeRequired": true
      },
      "compressed": true,
      "format": 1,
      "success": true,
      "total": 0,
      "errorMessage": "string",
      "trackerId": "string",
      "errors": [
        {
          "propertyName": "string",
          "errorMessage": "string"
        }
      ]
    }

- /api/login/refresh-token

  - Request
    {
      "accessToken": "string",
      "refreshToken": "string",
      "deviceId": "string"
    }
  - Response
    {
      "lastUpdatedTimeUtc": "2026-06-07T04:45:19.257Z",
      "data": {
        "userId": "string",
        "accessToken": "string",
        "refreshToken": "string",
        "accessTokenExpiryDateTimeUtc": "2026-06-07T04:45:19.257Z",
        "success": true,
        "errorMessage": "string",
        "displayName": "string",
        "email": "string",
        "isAuthorised": true,
        "isAuthenticated": true,
        "serverDateTimeUtc": "2026-06-07T04:45:19.257Z",
        "isMfaRequired": true,
        "mfaKey": "string",
        "passwordChangeRequired": true
      },
      "compressed": true,
      "format": 1,
      "success": true,
      "total": 0,
      "errorMessage": "string",
      "trackerId": "string",
      "errors": [
        {
          "propertyName": "string",
          "errorMessage": "string"
        }
      ]
  } 

Update the authentication flow to use the refresh token mechanism. The application should:

Authenticate using /api/login.
Store both the access token and refresh token securely.
Automatically call /api/login/refresh-token before or when the access token expires.
Retry the original request with the newly issued access token.
Ensure users remain authenticated without needing to log in again while the refresh token is valid.

The goal is to prevent bearer token expiration from interrupting API requests and provide seamless token renewal.