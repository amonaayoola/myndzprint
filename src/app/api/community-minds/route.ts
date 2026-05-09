import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// GET — return all community minds (type='community') built by any user
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('user_minds')
      .select('id, name, era, type, domain, quote, opening, tags, system, corpus, voice_style, brain, created_at')
      .eq('type', 'community')
      .order('created_at', { ascending: false })

    if (error) throw error

    const minds = (data || []).map(row => ({
      id: row.id,
      name: row.name,
      initial: row.name?.charAt(0)?.toUpperCase() ?? '?',
      domain: row.domain ?? '',
      era: row.era ?? '',
      type: 'community' as const,
      quote: row.quote ?? '',
      opening: row.opening ?? '',
      tags: row.tags ?? [],
      system: row.system ?? '',
      brain: row.brain ?? [],
      corpus: row.corpus ?? '',
    }))

    return NextResponse.json({ minds })
  } catch (err) {
    console.error('[community-minds GET]', err)
    return NextResponse.json({ minds: [] })
  }
}

// POST — publish a community mind (called from BuildModal after building)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { ownerEmail, ...mind } = body

    if (!mind.id || !mind.name) {
      return NextResponse.json({ error: 'Missing id or name' }, { status: 400 })
    }

    // Look up the user_id from their email
    const { data: users, error: userErr } = await supabase
      .from('auth.users')
      .select('id')
      .eq('email', ownerEmail)
      .limit(1)
      .maybeSingle()

    // If we can't find the user, still save the mind using a fallback
    const userId = users?.id ?? '00000000-0000-0000-0000-000000000000'

    if (userErr && !userId) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { error } = await supabase
      .from('user_minds')
      .upsert({
        id: mind.id,
        user_id: userId,
        name: mind.name,
        era: mind.era ?? '',
        type: 'community',
        domain: mind.domain ?? '',
        quote: mind.quote ?? '',
        opening: mind.opening ?? '',
        tags: mind.tags ?? [],
        system: mind.system ?? '',
        corpus: mind.corpus ?? '',
        voice_style: mind.voiceStyle ?? null,
        brain: mind.brain ?? [],
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id,user_id' })

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[community-minds POST]', err)
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }
}
