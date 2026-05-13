import { useCallback, useRef, useState } from "react";

export type ViaCepResult = {
  cep: string;
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
};

const cache = new Map<string, ViaCepResult>();

export function useCepLookup() {
  const [data, setData] = useState<ViaCepResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const lookup = useCallback(async (raw: string): Promise<ViaCepResult | null> => {
    const cep = (raw || "").replace(/\D/g, "");
    setError(null);
    if (cep.length !== 8) {
      setError("CEP incompleto");
      return null;
    }
    if (cache.has(cep)) {
      const cached = cache.get(cep)!;
      setData(cached);
      return cached;
    }
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const timeout = setTimeout(() => ctrl.abort(), 3000);
    setLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: ctrl.signal });
      const json = (await res.json()) as ViaCepResult;
      if (json.erro) {
        setError("CEP não encontrado");
        setData(null);
        return null;
      }
      cache.set(cep, json);
      setData(json);
      return json;
    } catch (e: any) {
      const msg = e?.name === "AbortError" ? "Tempo esgotado ao buscar CEP" : "Erro ao buscar CEP";
      setError(msg);
      setData(null);
      return null;
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  }, []);

  return { data, loading, error, lookup };
}

export const formatCep = (raw: string) => {
  const digits = (raw || "").replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
};
