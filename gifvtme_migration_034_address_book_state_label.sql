-- Keep existing saved addresses aligned with the shared Nigerian state list.
UPDATE public.addresses
SET state = 'FCT (Abuja)'
WHERE state = 'FCT - Abuja';
