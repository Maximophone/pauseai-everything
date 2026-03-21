-- Add sync provenance columns to contacts
-- sync_configuration_id: which sync created/last updated this contact (SET NULL if the sync is deleted)
-- synced_fields: JSONB array of CRM target field names that are managed by the sync (locked from manual edits)

ALTER TABLE contacts
  ADD COLUMN sync_configuration_id UUID REFERENCES sync_configurations(id) ON DELETE SET NULL,
  ADD COLUMN synced_fields JSONB DEFAULT NULL;
