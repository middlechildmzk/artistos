create policy "temporary_artistos_transfer_delete"
on storage.objects
for delete
to anon
using (
  bucket_id = 'app'
  and name in (
    'tmp/artistos-package-lock-20260724-2102.json',
    'tmp/artistos-package-lock-20260724-2107.json.gz.b64'
  )
);
