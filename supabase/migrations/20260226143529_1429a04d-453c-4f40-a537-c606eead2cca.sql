
-- Table to store WhatsApp conversation history for context
CREATE TABLE public.whatsapp_chat_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  phone TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  tool_name TEXT,
  tool_args JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for fast lookups by phone
CREATE INDEX idx_whatsapp_chat_phone ON public.whatsapp_chat_history (phone, created_at DESC);

-- Auto-cleanup: delete messages older than 24 hours
CREATE OR REPLACE FUNCTION public.cleanup_old_whatsapp_chat()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.whatsapp_chat_history
  WHERE created_at < now() - INTERVAL '24 hours';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trigger_cleanup_whatsapp_chat
AFTER INSERT ON public.whatsapp_chat_history
FOR EACH STATEMENT
EXECUTE FUNCTION public.cleanup_old_whatsapp_chat();

-- RLS
ALTER TABLE public.whatsapp_chat_history ENABLE ROW LEVEL SECURITY;

-- Only service role accesses this (edge functions use service role key)
CREATE POLICY "Service role only" ON public.whatsapp_chat_history
  FOR ALL USING (false);
