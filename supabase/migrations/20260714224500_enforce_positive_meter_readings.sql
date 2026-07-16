alter table public.charges
  add constraint charges_meter_previous_positive
  check (meter_previous is null or meter_previous > 0),
  add constraint charges_meter_current_positive
  check (meter_current is null or meter_current > 0),
  add constraint charges_meter_current_not_before_previous
  check (meter_previous is null or meter_current is null or meter_current >= meter_previous);
