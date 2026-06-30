import swaggerJsdoc from 'swagger-jsdoc';
import { getVersion } from './version';

const options: swaggerJsdoc.Options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'WITROS Oferty PV — API',
            version: getVersion().version,
            description:
                'Generator ofert handlowych dla fotowoltaiki. Zarządzanie produktami (rury, studnie), ofertami, zamówieniami, klientami i wycenami Preco.',
            contact: {
                name: 'WITROS'
            }
        },
        servers: [{ url: '/', description: 'Lokalny serwer' }],
        components: {
            securitySchemes: {
                cookieAuth: {
                    type: 'apiKey',
                    in: 'cookie',
                    name: 'token'
                }
            },
            schemas: {
                Error: {
                    type: 'object',
                    properties: {
                        error: { type: 'string' }
                    }
                },
                HealthResponse: {
                    type: 'object',
                    properties: {
                        status: { type: 'string', example: 'ok' },
                        timestamp: { type: 'string', format: 'date-time' },
                        uptime: { type: 'number' },
                        version: { type: 'string' }
                    }
                }
            }
        },
        tags: [
            { name: 'Auth', description: 'Autoryzacja i sesje' },
            { name: 'Users', description: 'Zarządzanie użytkownikami' },
            { name: 'Products Rury', description: 'Produkty — rury' },
            { name: 'Products Studnie', description: 'Produkty — studnie' },
            { name: 'Offers', description: 'Oferty handlowe (rury + studnie)' },
            { name: 'Orders', description: 'Zamówienia' },
            { name: 'Clients', description: 'Klienci' },
            { name: 'Audit', description: 'Logi audytowe' },
            { name: 'Settings', description: 'Ustawienia systemowe' },
            { name: 'Preco', description: 'Wyceny Preco' },
            { name: 'Telemetry', description: 'Telemetria aplikacji' },
            { name: 'System', description: 'Healthcheck i diagnostyka' }
        ]
    },
    apis: ['./src/routes/**/*.ts']
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;
