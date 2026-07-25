'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { NEVER_ALONE_PRESAVE_URL } from '@/lib/social-data';

const allowedPlatforms = new Set(['Instagram','Facebook','TikTok','YouTube Shorts','X','Email','Threads']);
const allowedStatuses = new Set(['idea','drafted','ready','scheduled','published','blocked']);
const allowedApprovals = new Set(['draft','review','approved','rejected']);

function value(form: FormData, key: string, max = 5000) {
  return String(form.get(key) ?? '').trim().slice(0, max);
}

export async function createContentItem(form: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Authentication required.');

  const platform = value(form, 'platform', 80);
  const status = value(form, 'status', 30);
  const approval = value(form, 'approval_state', 30);
  const scheduled = value(form, 'scheduled_for', 80);

  const payload = {
    release_id: value(form, 'release_id', 80) || null,
    title: value(form, 'title', 180),
    platform: allowedPlatforms.has(platform) ? platform : 'Instagram',
    post_type: value(form, 'post_type', 80) || null,
    content_type: value(form, 'post_type', 80) || null,
    status: allowedStatuses.has(status) ? status : 'drafted',
    approval_state: allowedApprovals.has(approval) ? approval : 'draft',
    scheduled_for: scheduled ? new Date(scheduled).toISOString() : null,
    cta: value(form, 'cta', 1000) || NEVER_ALONE_PRESAVE_URL,
    hook: value(form, 'hook', 500) || null,
    copy: value(form, 'copy', 10000) || null,
    hashtags: value(form, 'hashtags', 1200) || null,
    aspect_ratio: value(form, 'aspect_ratio', 30) || null,
    asset_id: value(form, 'asset_id', 80) || null,
    notes: value(form, 'notes', 3000) || null,
    source_content: value(form, 'source_content', 10000) || null,
    created_by: user.id,
  };

  if (!payload.title) throw new Error('A title is required.');
  const { error } = await supabase.from('content_items').insert(payload);
  if (error) throw new Error(error.message);
  revalidatePath('/social');
  revalidatePath('/content');
}

export async function updateContentStatus(form: FormData) {
  const supabase = await createClient();
  const id = value(form, 'id', 80);
  const status = value(form, 'status', 30);
  const approval = value(form, 'approval_state', 30);
  if (!id) throw new Error('Content item is required.');
  const patch: Record<string, string | null> = {};
  if (allowedStatuses.has(status)) patch.status = status;
  if (allowedApprovals.has(approval)) patch.approval_state = approval;
  if (status === 'published') patch.published_at = new Date().toISOString();
  const publishedUrl = value(form, 'published_url', 2000);
  if (publishedUrl) patch.published_url = publishedUrl;
  const { error } = await supabase.from('content_items').update(patch).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/social');
  revalidatePath('/content');
}

export async function boostPublishedPost(form: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Authentication required.');

  const sourceId = value(form, 'source_id', 80) || null;
  const sourceUrl = value(form, 'source_url', 2000);
  const sourceCopy = value(form, 'source_copy', 10000);
  const releaseId = value(form, 'release_id', 80) || null;
  if (!sourceUrl && !sourceCopy && !sourceId) throw new Error('Select or describe a published post.');

  const base = sourceCopy || 'Never Alone is coming July 31. Even in the darkest moments, you were never truly alone.';
  const variants = [
    {
      title: 'Story reshare: Never Alone', platform: 'Instagram', post_type: 'Story', aspect_ratio: '9:16',
      hook: 'This one is personal.', copy: `${base}\n\nPre-save “Never Alone” before July 31: ${NEVER_ALONE_PRESAVE_URL}`,
      notes: 'Reshare the source post to Stories. Add a direct pre-save sticker and one personal sentence.',
    },
    {
      title: 'Short-form follow-up: the meaning behind Never Alone', platform: 'TikTok', post_type: 'Short video', aspect_ratio: '9:16',
      hook: 'I wrote this during one of the hardest seasons of my life.', copy: `A short, direct follow-up explaining what “Never Alone” means. End with: ${NEVER_ALONE_PRESAVE_URL}`,
      notes: 'Use the strongest 8–15 second emotional moment. Keep the opening human and specific.',
    },
    {
      title: 'Conversation post: who needed this reminder?', platform: 'Facebook', post_type: 'Feed post', aspect_ratio: '4:5',
      hook: 'Who needs to hear this today?', copy: `${base}\n\nTag or send this to someone who may need the reminder. Pre-save: ${NEVER_ALONE_PRESAVE_URL}`,
      notes: 'Reply personally to meaningful comments. Do not use engagement bait or generic mass replies.',
    },
    {
      title: 'X follow-up: Never Alone pre-save', platform: 'X', post_type: 'Post', aspect_ratio: '16:9',
      hook: 'A song for anyone carrying more than they show.', copy: `“Never Alone” releases July 31. A song for anyone carrying more than they show.\n\n${NEVER_ALONE_PRESAVE_URL}`,
      notes: 'Post within 24 hours of the source post and pin during release week if it remains the strongest CTA.',
    },
  ];

  const rows = variants.map((variant, index) => ({
    ...variant,
    release_id: releaseId,
    parent_content_id: sourceId,
    source_content: sourceUrl || sourceCopy,
    status: 'drafted',
    approval_state: 'review',
    cta: NEVER_ALONE_PRESAVE_URL,
    scheduled_for: new Date(Date.now() + (index + 1) * 6 * 60 * 60 * 1000).toISOString(),
    created_by: user.id,
  }));

  const { error } = await supabase.from('content_items').insert(rows);
  if (error) throw new Error(error.message);
  revalidatePath('/social');
  revalidatePath('/content');
}

export async function recordCampaignMetric(form: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Authentication required.');
  const platform = value(form, 'platform', 80);
  const metricDate = value(form, 'metric_date', 20);
  const metrics = {
    views: Number(value(form, 'views', 30) || 0),
    reach: Number(value(form, 'reach', 30) || 0),
    likes: Number(value(form, 'likes', 30) || 0),
    comments: Number(value(form, 'comments', 30) || 0),
    shares: Number(value(form, 'shares', 30) || 0),
    clicks: Number(value(form, 'clicks', 30) || 0),
    saves: Number(value(form, 'saves', 30) || 0),
    spend: Number(value(form, 'spend', 30) || 0),
  };
  const { error } = await supabase.from('campaign_metrics').insert({
    release_id: value(form, 'release_id', 80) || null,
    platform,
    metric_date: metricDate || new Date().toISOString().slice(0, 10),
    source_type: 'manual',
    metrics,
    notes: value(form, 'notes', 3000) || null,
    created_by: user.id,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/social');
}
