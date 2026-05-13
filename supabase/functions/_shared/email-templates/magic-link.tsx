/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({
  siteName,
  confirmationUrl,
}: MagicLinkEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Seu link de acesso · {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <div style={brandRow}>
          <Text style={brand}>FrotaOps</Text>
          <Text style={brandTag}>Enterprise Fleet Intelligence</Text>
        </div>
        <Heading style={h1}>Acesse sua conta</Heading>
        <Text style={text}>
          Use o link abaixo para entrar na sua conta FrotaOps sem precisar de senha.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Entrar agora
        </Button>
        <Text style={footer}>
          Este link expira em 1 hora e só pode ser usado uma vez. Se não foi você quem solicitou, ignore este email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail

const main = { backgroundColor: '#ffffff', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '560px' }
const brandRow = { marginBottom: '28px' }
const brand = { fontSize: '20px', fontWeight: 'bold' as const, color: '#0f172a', letterSpacing: '-0.02em', margin: '0' }
const brandTag = { fontSize: '12px', color: '#64748b', margin: '2px 0 0' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#0f172a', margin: '0 0 16px', lineHeight: '1.3' }
const text = { fontSize: '15px', color: '#334155', lineHeight: '1.6', margin: '0 0 20px' }
const button = { backgroundColor: '#3b82f6', color: '#ffffff', fontSize: '15px', fontWeight: 'bold' as const, borderRadius: '10px', padding: '14px 28px', textDecoration: 'none', display: 'inline-block' }
const footer = { fontSize: '12px', color: '#94a3b8', margin: '32px 0 0', borderTop: '1px solid #e2e8f0', paddingTop: '20px' }
