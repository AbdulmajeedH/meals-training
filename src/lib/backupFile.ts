import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { exportBackup, importBackup, type ImportResult } from '@/db/backup';
import { getClient, isConfigured } from './supabase';

/**
 * Getting a backup off the phone and back on again.
 *
 * Two independent routes, so neither is a single point of failure: a JSON file
 * shared anywhere, and an optional Supabase Storage upload.
 */

const BUCKET = 'backups';

function filename(): string {
  return `meals-training-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
}

/** Write the backup to a file and open the system share sheet. */
export async function shareBackupFile(): Promise<{ ok: boolean; message?: string }> {
  try {
    const file = new File(Paths.cache, filename());
    file.create({ overwrite: true });
    file.write(JSON.stringify(exportBackup(), null, 2));

    if (!(await Sharing.isAvailableAsync())) {
      return { ok: false, message: 'المشاركة غير متاحة على هذا الجهاز.' };
    }

    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/json',
      dialogTitle: 'نسخة احتياطية',
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'فشل التصدير.' };
  }
}

/** Pick a JSON backup and restore it. */
export async function restoreFromFile(): Promise<ImportResult | { ok: false; reason: 'cancelled' }> {
  try {
    const picked = await DocumentPicker.getDocumentAsync({
      type: 'application/json',
      copyToCacheDirectory: true,
    });

    if (picked.canceled || picked.assets.length === 0) return { ok: false, reason: 'cancelled' };

    const file = new File(picked.assets[0].uri);
    return importBackup(JSON.parse(file.textSync()));
  } catch (error) {
    return {
      ok: false,
      reason: 'failed',
      message: error instanceof Error ? error.message : undefined,
    };
  }
}

/* ------------------------------------------------------------- supabase */

export async function uploadBackup(): Promise<{ ok: boolean; message?: string }> {
  if (!isConfigured()) return { ok: false, message: 'لم تُضبط إعدادات Supabase.' };
  const client = getClient();
  if (!client) return { ok: false, message: 'لم تُضبط إعدادات Supabase.' };

  try {
    const name = filename();
    const body = JSON.stringify(exportBackup());
    const { error } = await client.storage
      .from(BUCKET)
      .upload(name, body, { contentType: 'application/json', upsert: false });

    if (error) return { ok: false, message: error.message };
    return { ok: true, message: name };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'فشل الرفع.' };
  }
}

export type RemoteBackup = { name: string; createdAt: string | null };

export async function listRemoteBackups(): Promise<RemoteBackup[]> {
  const client = getClient();
  if (!client) return [];

  const { data, error } = await client.storage
    .from(BUCKET)
    .list('', { sortBy: { column: 'name', order: 'desc' }, limit: 20 });

  if (error || !data) return [];
  return data.map((entry) => ({ name: entry.name, createdAt: entry.created_at ?? null }));
}

export async function restoreFromRemote(name: string): Promise<ImportResult> {
  const client = getClient();
  if (!client) return { ok: false, reason: 'failed', message: 'لم تُضبط إعدادات Supabase.' };

  try {
    const { data, error } = await client.storage.from(BUCKET).download(name);
    if (error || !data) {
      return { ok: false, reason: 'failed', message: error?.message };
    }
    return importBackup(JSON.parse(await data.text()));
  } catch (error) {
    return {
      ok: false,
      reason: 'failed',
      message: error instanceof Error ? error.message : undefined,
    };
  }
}
