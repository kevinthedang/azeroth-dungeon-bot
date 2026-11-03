import type { Collection, GuildMember } from 'discord.js'

export interface MemberResolution {
    members: GuildMember[]
    unknown: string[]
    ambiguous: string[]
}

/**
 * Split the `members` option into individual names. Accepts comma or whitespace
 * separators, @mentions, and double-quoted names so display names containing
 * spaces can still be entered.
 */
export function parseMemberTokens(input: string): string[] {
    const matches = input.match(/"[^"]+"|<@!?\d+>|[^,\s]+/g) ?? []

    const tokens = matches
        .map(token => token.replace(/^"|"$/g, '').trim())
        .filter(Boolean)

    return [...new Set(tokens)]
}

function resolveToken(
    guildMembers: Collection<string, GuildMember>,
    token: string,
): GuildMember | 'ambiguous' | null {
    // explicit mention: <@123> or <@!123>
    const mention = token.match(/^<@!?(\d+)>$/)
    if (mention) return guildMembers.get(mention[1]!) ?? null

    const needle = token.toLowerCase()

    const candidates = guildMembers.filter(member =>
        member.user.username.toLowerCase() === needle
        || member.user.globalName?.toLowerCase() === needle
        || member.displayName.toLowerCase() === needle
        || member.nickname?.toLowerCase() === needle
    )

    if (candidates.size === 0) return null

    // usernames (handles) win over display names when both match
    const usernameMatches = candidates.filter(member => member.user.username.toLowerCase() === needle)
    const pool = usernameMatches.size > 0 ? usernameMatches : candidates

    if (pool.size === 1) return pool.first()!

    // a unique global display name can disambiguate the rest
    const globalNameMatches = pool.filter(member => member.user.globalName?.toLowerCase() === needle)
    if (globalNameMatches.size === 1) return globalNameMatches.first()!

    return 'ambiguous'
}

/**
 * Match each token against the guild's members. Names that match nobody are
 * returned as `unknown`; names matching multiple members are `ambiguous`.
 */
export function resolveMemberTokens(
    guildMembers: Collection<string, GuildMember>,
    tokens: string[],
): MemberResolution {
    const members: GuildMember[] = []
    const unknown: string[] = []
    const ambiguous: string[] = []
    const seen = new Set<string>()

    for (const token of tokens) {
        const resolved = resolveToken(guildMembers, token)

        if (resolved === null) {
            unknown.push(token)
        } else if (resolved === 'ambiguous') {
            ambiguous.push(token)
        } else if (!seen.has(resolved.id)) {
            seen.add(resolved.id)
            members.push(resolved)
        }
    }

    return { members, unknown, ambiguous }
}
