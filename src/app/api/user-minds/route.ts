import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// GET — return all minds for the authenticated user
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (!token) {
      return NextResponse.json({ minds: [] })
    }

    // Verify the JWT and get user
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
    if (authErr || !user) {
      return NextResponse.json({ minds: [] })
    }

    const { data, error } = await supabase
      .from('user_minds')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw error

    const minds = (data || []).map(row => ({
      id: row.id,
      name: row.name,
      initial: row.name?.charAt(0)?.toUpperCase() ?? '?',
      domain: row.domain ?? '',
      era: row.era ?? '',
      type: row.type ?? 'personal',
      quote: row.quote ?? '',
      opening: row.opening ?? '',
      tags: row.tags ?? [],
      system: row.system ?? '',
      brain: row.brain ?? [],
      corpus: row.corpus ?? '',
      ownerEmail: user.email,
    }))

    return NextResponse.json({ minds })
  } catch (err) {
    console.error('[user-minds GET]', err)
    return NextResponse.json({ minds: [] })
  }
}

// POST — save or update a user's mind
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const mind = await req.json()

    if (!mind.id || !mind.name) {
      return NextResponse.json({ error: 'Missing id or name' }, { status: 400 })
    }

    const { error } = await supabase
      .from('user_minds')
      .upsert({
        id: mind.id,
        user_id: user.id,
        name: mind.name,
        era: mind.era ?? '',
        type: mind.type ?? 'personal',
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
    console.error('[user-minds POST]', err)
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }
}
