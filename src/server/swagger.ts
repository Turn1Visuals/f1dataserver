import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "F1 Data Server",
      version: "1.0.0",
      description: "Local F1 data hub — historical and current season data served via REST.",
    },
    servers: [{ url: "http://localhost:5320" }],
    components: {
      schemas: {
        Season: {
          type: "object",
          properties: {
            year: { type: "integer", example: 2026 },
            rounds: { type: "integer", example: 22 },
          },
        },
        Driver: {
          type: "object",
          properties: {
            id: { type: "string" },
            firstName: { type: "string", example: "Max" },
            lastName: { type: "string", example: "Verstappen" },
            code: { type: "string", example: "VER" },
            permanentNumber: { type: "integer", example: 1 },
            dob: { type: "string", format: "date" },
            nationality: { type: "string", example: "Dutch" },
            headshotUrl: { type: "string", nullable: true },
            countryCode: { type: "string", example: "NLD", nullable: true },
          },
        },
        Constructor: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string", example: "Red Bull" },
            nationality: { type: "string", example: "Austrian" },
            teamColour: { type: "string", example: "#3671C6", nullable: true },
          },
        },
        Circuit: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string", example: "Silverstone Circuit" },
            locality: { type: "string", example: "Silverstone" },
            country: { type: "string", example: "UK" },
            lat: { type: "number", example: 52.0786 },
            lng: { type: "number", example: -1.01694 },
            circuitType: { type: "string", example: "Permanent", nullable: true },
            circuitImageUrl: { type: "string", nullable: true },
          },
        },
        Event: {
          type: "object",
          properties: {
            id: { type: "string" },
            seasonYear: { type: "integer", example: 2026 },
            round: { type: "integer", example: 1 },
            jolpikaName: { type: "string", example: "Australian Grand Prix" },
            officialName: { type: "string", nullable: true },
            date: { type: "string", format: "date" },
            location: { type: "string", nullable: true },
            country: { type: "string", nullable: true },
            flagUrl: { type: "string", nullable: true },
            gmtOffset: { type: "string", nullable: true },
          },
        },
        Session: {
          type: "object",
          properties: {
            id: { type: "string" },
            type: {
              type: "string",
              enum: ["PRACTICE_1", "PRACTICE_2", "PRACTICE_3", "QUALIFYING", "SPRINT_QUALIFYING", "SPRINT", "RACE"],
            },
            name: { type: "string" },
            dateStart: { type: "string", format: "date-time", nullable: true },
            dateEnd: { type: "string", format: "date-time", nullable: true },
          },
        },
        Result: {
          type: "object",
          properties: {
            position: { type: "integer", nullable: true },
            positionText: { type: "string", nullable: true },
            points: { type: "number", nullable: true },
            grid: { type: "integer", nullable: true },
            laps: { type: "integer", nullable: true },
            status: { type: "string", nullable: true },
            timeMs: { type: "integer", nullable: true },
          },
        },
        Error: {
          type: "object",
          properties: {
            error: { type: "string" },
          },
        },
      },
    },
    tags: [
      { name: "Seasons", description: "Season calendar and metadata" },
      { name: "Drivers", description: "Driver profiles and season history" },
      { name: "Constructors", description: "Constructor/team profiles" },
      { name: "Circuits", description: "Circuit information" },
      { name: "Events", description: "Race weekends with sessions and results" },
      { name: "Standings", description: "Driver and constructor championship standings" },
      { name: "Session", description: "Live timing and playback session control" },
      { name: "F1 Status", description: "F1 event tracker and streaming status" },
      { name: "System", description: "Server health and info" },
    ],
    paths: {
      "/health": {
        get: {
          tags: ["System"],
          summary: "Health check",
          responses: {
            "200": {
              description: "Server is running",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      status: { type: "string", example: "ok" },
                      timestamp: { type: "string", format: "date-time" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/seasons": {
        get: {
          tags: ["Seasons"],
          summary: "List all seasons",
          responses: {
            "200": {
              description: "Array of seasons",
              content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Season" } } } },
            },
          },
        },
      },
      "/seasons/{year}": {
        get: {
          tags: ["Seasons"],
          summary: "Get season by year with all events",
          parameters: [{ name: "year", in: "path", required: true, schema: { type: "integer", example: 2026 } }],
          responses: {
            "200": {
              description: "Season with events and circuits",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Season" } } },
            },
            "404": { description: "Season not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
      "/drivers": {
        get: {
          tags: ["Drivers"],
          summary: "List drivers",
          parameters: [{ name: "season", in: "query", required: false, schema: { type: "integer", example: 2026 }, description: "Filter by season year" }],
          responses: {
            "200": {
              description: "Array of drivers",
              content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Driver" } } } },
            },
          },
        },
      },
      "/drivers/{id}": {
        get: {
          tags: ["Drivers"],
          summary: "Get driver by ID with full season history",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            "200": { description: "Driver detail", content: { "application/json": { schema: { $ref: "#/components/schemas/Driver" } } } },
            "404": { description: "Driver not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
      "/constructors": {
        get: {
          tags: ["Constructors"],
          summary: "List constructors",
          parameters: [{ name: "season", in: "query", required: false, schema: { type: "integer", example: 2026 }, description: "Filter by season year" }],
          responses: {
            "200": {
              description: "Array of constructors",
              content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Constructor" } } } },
            },
          },
        },
      },
      "/constructors/{id}": {
        get: {
          tags: ["Constructors"],
          summary: "Get constructor by ID with drivers",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            "200": { description: "Constructor detail", content: { "application/json": { schema: { $ref: "#/components/schemas/Constructor" } } } },
            "404": { description: "Constructor not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
      "/circuits": {
        get: {
          tags: ["Circuits"],
          summary: "List all circuits",
          responses: {
            "200": {
              description: "Array of circuits",
              content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Circuit" } } } },
            },
          },
        },
      },
      "/circuits/{id}": {
        get: {
          tags: ["Circuits"],
          summary: "Get circuit by ID with recent events",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            "200": { description: "Circuit detail", content: { "application/json": { schema: { $ref: "#/components/schemas/Circuit" } } } },
            "404": { description: "Circuit not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
      "/events": {
        get: {
          tags: ["Events"],
          summary: "List events",
          parameters: [{ name: "season", in: "query", required: false, schema: { type: "integer", example: 2026 }, description: "Filter by season year" }],
          responses: {
            "200": {
              description: "Array of events with circuit and sessions",
              content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Event" } } } },
            },
          },
        },
      },
      "/events/{id}": {
        get: {
          tags: ["Events"],
          summary: "Get event by ID with sessions and results",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            "200": { description: "Event detail with sessions and results", content: { "application/json": { schema: { $ref: "#/components/schemas/Event" } } } },
            "404": { description: "Event not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },

      // ── Standings ───────────────────────────────────────────────────────────
      "/standings/{year}/drivers": {
        get: {
          tags: ["Standings"],
          summary: "Driver championship standings",
          description: "Returns standings for the given season. Defaults to the latest round with data. Use `?round=N` for a specific round.",
          parameters: [
            { name: "year", in: "path", required: true, schema: { type: "integer", example: 2026 } },
            { name: "round", in: "query", required: false, schema: { type: "integer", example: 5 }, description: "Round number (omit for latest)" },
          ],
          responses: {
            "200": {
              description: "Driver standings",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      season: { type: "integer", example: 2026 },
                      round:  { type: "integer", example: 5 },
                      standings: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            position:    { type: "integer", example: 1 },
                            points:      { type: "number", example: 119 },
                            wins:        { type: "integer", example: 4 },
                            driverId:    { type: "string" },
                            code:        { type: "string", example: "VER" },
                            name:        { type: "string", example: "Max Verstappen" },
                            nationality: { type: "string", example: "Dutch" },
                            team:        { type: "string", example: "Red Bull Racing" },
                            teamId:      { type: "string" },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            "500": { description: "Server error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
      "/standings/{year}/constructors": {
        get: {
          tags: ["Standings"],
          summary: "Constructor championship standings",
          description: "Returns standings for the given season. Defaults to the latest round with data. Use `?round=N` for a specific round.",
          parameters: [
            { name: "year", in: "path", required: true, schema: { type: "integer", example: 2026 } },
            { name: "round", in: "query", required: false, schema: { type: "integer", example: 5 }, description: "Round number (omit for latest)" },
          ],
          responses: {
            "200": {
              description: "Constructor standings",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      season: { type: "integer", example: 2026 },
                      round:  { type: "integer", example: 5 },
                      standings: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            position:    { type: "integer", example: 1 },
                            points:      { type: "number", example: 210 },
                            wins:        { type: "integer", example: 4 },
                            teamId:      { type: "string" },
                            name:        { type: "string", example: "Red Bull Racing" },
                            nationality: { type: "string", example: "Austrian" },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            "500": { description: "Server error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },

      // ── Session control ─────────────────────────────────────────────────────
      "/session/status": {
        get: {
          tags: ["Session"],
          summary: "Current session status",
          responses: {
            "200": {
              description: "Session status",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      mode:          { type: "string", enum: ["idle", "live", "playback"] },
                      sessionPath:   { type: "string", nullable: true },
                      playing:       { type: "boolean" },
                      offsetMs:      { type: "integer" },
                      durationMs:    { type: "integer" },
                      speed:         { type: "number" },
                      delayMs:       { type: "integer" },
                      snapshotReady: { type: "boolean" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/session/live": {
        post: {
          tags: ["Session"],
          summary: "Connect to F1 live timing",
          description: "Connects to F1 SignalR hub using the stored token. Retries automatically if dropped before subscribing.",
          responses: {
            "200": { description: "Connection initiated" },
            "401": { description: "No token — login first", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
      "/session/live/disconnect": {
        post: {
          tags: ["Session"],
          summary: "Disconnect from live timing",
          responses: { "200": { description: "Disconnected" } },
        },
      },
      "/session/load": {
        post: {
          tags: ["Session"],
          summary: "Load a session for playback",
          description: "Fetches from F1 static archive if not cached, then loads into playback engine.",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object", properties: { sessionPath: { type: "string", example: "2025/1234_BahrainGrandPrix/Race/" } } } } },
          },
          responses: {
            "200": { description: "Session loaded", content: { "application/json": { schema: { type: "object", properties: { ok: { type: "boolean" }, events: { type: "integer" }, durationMs: { type: "integer" } } } } } },
            "400": { description: "sessionPath required" },
          },
        },
      },
      "/session/play": {
        post: {
          tags: ["Session"],
          summary: "Start playback",
          requestBody: { content: { "application/json": { schema: { type: "object", properties: { speed: { type: "number", example: 1 } } } } } },
          responses: { "200": { description: "Playback started" } },
        },
      },
      "/session/pause": {
        post: {
          tags: ["Session"],
          summary: "Pause playback",
          responses: { "200": { description: "Playback paused" } },
        },
      },
      "/session/delay": {
        get: {
          tags: ["Session"],
          summary: "Get current broadcast delay",
          responses: { "200": { description: "Current delay in ms", content: { "application/json": { schema: { type: "object", properties: { delayMs: { type: "integer" } } } } } } },
        },
        post: {
          tags: ["Session"],
          summary: "Set broadcast delay",
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { ms: { type: "integer", example: 30000 } } } } } },
          responses: { "200": { description: "Delay updated" } },
        },
      },
      "/session/index": {
        get: {
          tags: ["Session"],
          summary: "Browse F1 season archive",
          parameters: [{ name: "year", in: "query", required: false, schema: { type: "integer", example: 2026 } }],
          responses: { "200": { description: "List of meetings and sessions" } },
        },
      },
      "/session/cached": {
        get: {
          tags: ["Session"],
          summary: "List locally cached sessions",
          responses: { "200": { description: "Array of cached session paths with size" } },
        },
      },
      "/session/circuit": {
        get: {
          tags: ["Session"],
          summary: "Get circuit layout for current session",
          description: "Returns MultiViewer circuit layout (track path, corners, DRS zones, etc.) for the currently loaded session.",
          responses: {
            "200": { description: "Circuit layout from MultiViewer API" },
            "404": { description: "No session loaded yet" },
          },
        },
      },
      "/session/auth/status": {
        get: {
          tags: ["Session"],
          summary: "F1 account auth status",
          responses: {
            "200": {
              description: "Auth status",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      loggedIn:  { type: "boolean" },
                      expiresAt: { type: "string", format: "date-time", nullable: true },
                      pending:   { type: "boolean" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/session/auth/login": {
        post: {
          tags: ["Session"],
          summary: "Start F1 browser login",
          description: "Opens Chrome with a persistent profile. Log in to your F1 account — token is saved automatically.",
          responses: {
            "202": { description: "Login started" },
            "409": { description: "Login already in progress" },
          },
        },
      },
      "/session/auth/logout": {
        post: {
          tags: ["Session"],
          summary: "Clear stored F1 token",
          responses: { "200": { description: "Logged out" } },
        },
      },

      // ── F1 Status ───────────────────────────────────────────────────────────
      "/event-tracker": {
        get: {
          tags: ["F1 Status"],
          summary: "Current F1 event and session timetable",
          description: "Proxies the F1 event tracker API. Returns current event info and session schedule with states (upcoming/live/completed). Cached for 1 minute.",
          responses: { "200": { description: "Event tracker data from formula1.com" }, "502": { description: "F1 API unavailable" } },
        },
      },
      "/streaming-status": {
        get: {
          tags: ["F1 Status"],
          summary: "F1 live timing streaming status",
          description: "Returns whether the F1 live timing feed is available. Cached for 15 seconds.",
          responses: {
            "200": {
              description: "Streaming status",
              content: {
                "application/json": {
                  schema: { type: "object", properties: { Status: { type: "string", example: "Available", enum: ["Available", "Offline"] } } },
                },
              },
            },
          },
        },
      },
    },
  },
  apis: [],
};

export const swaggerSpec = swaggerJsdoc(options);
