# wikirace
Wiki race competition. A badly vibe-coded version. A more *gamey* experience: Get first to a link, but with various configurable elements such as effect cards, timers and rules for not picking fast enough - bomb, return, or swap with your enemies.

## Deployment

To deploy the WikiRace application, you'll need to set up the following environment variables:

### Required Environment Variables

- `PORT` (optional, defaults to 3000)
  - The port number on which the server will run
  - Example: `PORT=3000`

- `PRODUCTION` (optional, defaults to false)
  - Set to "true" when deploying to production
  - This affects various behaviors like error handling and logging
  - Example: `PRODUCTION=true`

- `BASE_URL` (optional, defaults to http://localhost:${PORT})
  - The base URL of your deployment
  - Used for generating QR codes and sharing URLs
  - Example: `BASE_URL=https://your-domain.com`

- `MAX_ROOMS` (optional, defaults to 10)
  - Maximum number of concurrent game rooms allowed
  - Adjust based on your server capacity
  - Example: `MAX_ROOMS=20`

- `PATH_API` (optional)
  - URL of the path finding API service
  - Used to fetch shortest paths between Wikipedia articles
  - If not provided, path finding functionality will be disabled
  - For example, host your own instance of `https://sixdegreesofwikipedia.com/` and expose the API.
  - Example: `PATH_API=https://path-api.example.com/find`

### Example Deployment Setup

1. Create a `.env` file in the root directory:
```bash
PORT=3000
PRODUCTION=true
BASE_URL=https://your-domain.com
MAX_ROOMS=20
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

### Production Considerations

- Make sure to set `PRODUCTION=true` in production environments
- Set an appropriate `MAX_ROOMS` value based on your server's capacity
- Ensure `BASE_URL` is set to your actual domain for proper QR code generation
- Consider using a process manager like PM2 for production deployments
- Set up proper SSL/TLS certificates if using HTTPS

## Configuration

The following environment variables can be set to configure the application:

- `PORT`: The port number the server will listen on (default: 3000)
- `WEBSOCKET_PING_INTERVAL`: Interval in milliseconds for WebSocket ping messages to check connection health (default: 10000)
