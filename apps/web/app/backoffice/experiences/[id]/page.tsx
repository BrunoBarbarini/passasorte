"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "../../../../src/context/auth-context";
import { apiRequest } from "../../../../src/lib/api-client";
import type { ExperienceStatus, ExperienceView } from "../../../../src/types/api";
import { Nav } from "../../../../src/components/Nav";
import { Banner, Button, Card, Field, Input, LinkButton, PageHeader, Select, StatusPill, Textarea } from "../../../../src/components/ui";
import { spacing } from "../../../../src/theme/tokens";

const STATUSES: ExperienceStatus[] = ["DRAFT", "ACTIVE", "ARCHIVED"];

/** FR-012 Experience Management — view/edit one experience. */
export default function ExperienceDetailPage() {
  const params = useParams<{ id: string }>();
  const experienceId = params.id;
  const { session, loading } = useAuth();
  const router = useRouter();

  const [experience, setExperience] = useState<ExperienceView | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<ExperienceStatus>("DRAFT");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !session) router.replace("/login");
  }, [loading, session, router]);

  const refresh = useCallback(async () => {
    if (!session) return;
    const exp = await apiRequest<ExperienceView>(`/experiences/${experienceId}`, {
      accessToken: session.access_token,
    });
    setExperience(exp);
    setTitle(exp.title);
    setDescription(exp.description);
    setStatus(exp.status);
  }, [session, experienceId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleUpdate(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      await apiRequest(`/experiences/${experienceId}`, {
        method: "PATCH",
        accessToken: session.access_token,
        body: { title, description, status },
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao atualizar experience.");
    } finally {
      setBusy(false);
    }
  }

  if (loading || !session || !experience) {
    return <main style={{ padding: spacing.xl }}>Carregando...</main>;
  }

  return (
    <>
      <Nav />
      <main style={{ padding: spacing.xl, maxWidth: 700, margin: "0 auto" }}>
        <PageHeader
          title={experience.title}
          actions={<StatusPill status={experience.status} />}
        />
        {error && <Banner tone="error">{error}</Banner>}
        <Card style={{ marginBottom: spacing.lg }}>
          <form onSubmit={(e) => void handleUpdate(e)}>
            <Field label="Título" htmlFor="title">
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </Field>
            <Field label="Descrição" htmlFor="description">
              <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} />
            </Field>
            <Field label="Status" htmlFor="status">
              <Select id="status" value={status} onChange={(e) => setStatus(e.target.value as ExperienceStatus)}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </Field>
            <Button type="submit" loading={busy}>
              Salvar alterações
            </Button>
          </form>
        </Card>
        <LinkButton href={`/backoffice/merchants/${experience.merchantId}`}>← Voltar ao merchant</LinkButton>
        {" "}
        <LinkButton href={`/backoffice/campaigns?merchantId=${experience.merchantId}&experienceId=${experienceId}`} variant="primary">
          Criar campanha com essa experience
        </LinkButton>
      </main>
    </>
  );
}
