-- 014_stock_state_numeric.sql
-- on_hand is NUMERIC after 013; update stock_state to match.

CREATE OR REPLACE FUNCTION stock_state(p_on_hand NUMERIC, p_reorder INT) RETURNS TEXT AS $$
  SELECT CASE
           WHEN p_on_hand <= 0          THEN 'out'
           WHEN p_on_hand <= p_reorder  THEN 'low'
           ELSE 'in_stock'
         END;
$$ LANGUAGE sql IMMUTABLE;
