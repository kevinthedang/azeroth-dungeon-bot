import { config } from 'dotenv'
import { resolve } from 'path'

// resolve config file
const envFilePath = resolve(process.cwd(), '.env')
const ipValidate: RegExp = /^((25[0-5]|(2[0-4]|1\d|[1-9]|)\d)\.?\b){4}$/

// set current environment variable file
config({ path: envFilePath })


/**
 * Method to validate if environment variables found in file utils/env.ts
 * 
 * @param name Name of the environment variable in .env
 * @param fallback fallback value to set if environment variable is not set (used manually in src/keys.ts)
 * @returns environment variable value
 */
export function getEnvVar(name: string, fallback?: string): string {
    const value = process.env[name] ?? fallback
    if (!value)
        throw new Error(`Environment variable ${name} is not set.`)

    // return env variable
    return value
}