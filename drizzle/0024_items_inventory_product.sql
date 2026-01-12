ALTER TYPE ai_task_type ADD VALUE IF NOT EXISTS 'assign_item_to_warehouse';

ALTER TABLE items
  ADD COLUMN IF NOT EXISTS inventory_product_id uuid REFERENCES products(id);
