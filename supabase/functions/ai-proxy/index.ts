import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GoogleGenAI } from "https://esm.sh/@google/genai@0.1.1";

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('API_KEY');
    if (!apiKey) {
      throw new Error('Missing API_KEY in Edge Function secrets');
    }

    const { model, contents, config } = await req.json();

    const ai = new GoogleGenAI({ apiKey });
    
    // We map the request directly to the generateContent call
    // Note: In production, you might want to sanitize 'config' to prevent abuse (e.g. limit tokens)
    const response = await ai.models.generateContent({
      model: model || 'gemini-3-flash-preview',
      contents,
      config
    });

    // Serialize the response
    const data = {
      text: response.text,
      candidates: response.candidates,
      // Pass through other metadata if needed
    };

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});