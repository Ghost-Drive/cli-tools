// authMiddleware.ts
import { Middleware } from "koa";

interface CustomContext {
    header: {
        authorization?: string;
    };
    configuration: {
        store: any; // Replace 'any' with the Type of the store, e.g., StoreType
    };
    store: any; // Replace 'any' with the Type of the store, e.g., StoreType
}

const authMiddleware: Middleware = () => {
    return async (ctx: CustomContext, next: () => Promise<any>) => {
        // Implement your custom authentication logic here
        // Example: Check for authentication in ctx.header.authorization

        if (!ctx.header.authorization) {
            throw new Error(
                "No authorization header found. Access denied."
            );
        }

        // Pass the authorization credentials to the store constructor
        // @todo get values from actual header
        const accessKey = "your-access-key-id-from-header";
        const secretAccessKey = "your-secret-access-key-from-header";
        ctx.store = new ctx.configuration.store(accessKey, secretAccessKey);

        // Continue to the next middleware
        await next();
    };
};

export default authMiddleware;