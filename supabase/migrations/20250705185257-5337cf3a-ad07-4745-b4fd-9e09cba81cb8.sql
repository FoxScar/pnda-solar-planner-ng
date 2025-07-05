
-- Create a table to store user quotes
CREATE TABLE public.quotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  quote_data JSONB NOT NULL,
  appliances_data JSONB NOT NULL,
  inverter_data JSONB NOT NULL,
  battery_data JSONB NOT NULL,
  panel_data JSONB NOT NULL,
  total_cost INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

-- Create policies for quotes table
CREATE POLICY "Users can view their own quotes" 
  ON public.quotes 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own quotes" 
  ON public.quotes 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own quotes" 
  ON public.quotes 
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own quotes" 
  ON public.quotes 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Create an index for better performance when fetching user quotes
CREATE INDEX idx_quotes_user_id_created_at ON public.quotes(user_id, created_at DESC);
