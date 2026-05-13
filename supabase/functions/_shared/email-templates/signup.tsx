/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Confirm your email for {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <div style={brandRow}>
          <Text style={brand}>FrotaOps</Text>
          <Text style={brandTag}>Enterprise Fleet Intelligence</Text>
        </div>
        <Heading style={h1}>Bem-vindo à FrotaOps</Heading>
        <Text style={text}>
          Estamos felizes em ter você por aqui. Para ativar sua conta e começar a usar o painel de comando da sua frota, confirme seu email clicando no botão abaixo.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Confirmar email
        </Button>
        <Text style={text}>
          Email cadastrado:{' '}
          <Link href={`mailto:${recipient}`} style={link}>{recipient}</Link>
        </Text>
        <Text style={footer}>
          Este link expira em 24 horas. Se não foi você quem criou esta conta, pode ignorar este email com segurança.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

const main = { backgroundColor: '#ffffff', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '560px' }
const brandRow = { marginBottom: '28px' }
const brand = { fontSize: '20px', fontWeight: 'bold' as const, color: '#0f172a', letterSpacing: '-0.02em', margin: '0' }
const brandTag = { fontSize: '12px', color: '#64748b', margin: '2px 0 0' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#0f172a', margin: '0 0 16px', lineHeight: '1.3' }
const text = { fontSize: '15px', color: '#334155', lineHeight: '1.6', margin: '0 0 20px' }
const link = { color: '#3b82f6', textDecoration: 'underline' }
const button = { backgroundColor: '#3b82f6', color: '#ffffff', fontSize: '15px', fontWeight: 'bold' as const, borderRadius: '10px', padding: '14px 28px', textDecoration: 'none', display: 'inline-block' }
const footer = { fontSize: '12px', color: '#94a3b8', margin: '32px 0 0', borderTop: '1px solid #e2e8f0', paddingTop: '20px' }
