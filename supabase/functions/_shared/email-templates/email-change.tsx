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

interface EmailChangeEmailProps {
  siteName: string
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  siteName,
  oldEmail,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Confirme seu novo email · {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <div style={brandRow}>
          <Text style={brand}>FrotaOps</Text>
          <Text style={brandTag}>Enterprise Fleet Intelligence</Text>
        </div>
        <Heading style={h1}>Confirmação de novo email</Heading>
        <Text style={text}>
          Você solicitou alterar o email de acesso da sua conta FrotaOps de{' '}
          <Link href={`mailto:${oldEmail}`} style={link}>{oldEmail}</Link>{' '}
          para{' '}
          <Link href={`mailto:${newEmail}`} style={link}>{newEmail}</Link>.
        </Text>
        <Text style={text}>
          Para confirmar essa alteração, clique no botão abaixo.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Confirmar novo email
        </Button>
        <Text style={footer}>
          Se não foi você quem solicitou, entre em contato imediatamente: contato@frotaops.com.br
        </Text>
      </Container>
    </Body>
  </Html>
)

export default EmailChangeEmail

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
