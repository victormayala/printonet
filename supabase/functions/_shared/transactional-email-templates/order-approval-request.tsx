/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface OrderApprovalRequestProps {
  storeName?: string
  approvalUrl?: string
  orderShortCode?: string
  proofImageUrl?: string
}

const OrderApprovalRequestEmail = ({
  storeName,
  approvalUrl,
  orderShortCode,
  proofImageUrl,
}: OrderApprovalRequestProps) => {
  const brand = storeName || 'Your print shop'
  const url = approvalUrl || 'https://example.com/approval/sample-token'
  const code = orderShortCode || 'ABCD1234'

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Please review and approve your print proof for order #{code}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Your print proof is ready</Heading>
          <Text style={text}>
            {brand} has prepared the print proof for order{' '}
            <strong style={mono}>#{code}</strong>. Please take a moment to review
            the design before we send it to production.
          </Text>
          {proofImageUrl ? (
            <Section style={imageWrap}>
              <Img
                src={proofImageUrl}
                alt={`Print proof for order ${code}`}
                style={proofImg}
              />
            </Section>
          ) : null}
          <Text style={text}>
            You can approve the proof, or request changes with a comment, from
            the secure link below.
          </Text>
          <Section style={buttonWrap}>
            <Button href={url} style={button}>
              Review &amp; approve proof
            </Button>
          </Section>
          <Text style={small}>
            If the button does not work, copy and paste this link into your
            browser:
          </Text>
          <Text style={link}>{url}</Text>
          <Text style={footer}>
            This link is unique to your order. Please do not share it.
            <br />— The {brand} team
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: OrderApprovalRequestEmail,
  subject: (data: Record<string, any>) =>
    `Please approve your print proof${data?.orderShortCode ? ` (#${data.orderShortCode})` : ''}`,
  displayName: 'Order approval request',
  previewData: {
    storeName: 'Acme Apparel',
    approvalUrl: 'https://printonet.lovable.app/approval/sample-token',
    orderShortCode: 'A1B2C3D4',
  },
} satisfies TemplateEntry

const main = {
  backgroundColor: '#ffffff',
  fontFamily:
    "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif",
  padding: '32px 0',
}
const container = {
  maxWidth: '560px',
  margin: '0 auto',
  padding: '32px 28px',
  backgroundColor: '#fafafa',
  borderRadius: '12px',
  border: '1px solid #ececec',
}
const h1 = {
  fontSize: '24px',
  fontWeight: 600,
  color: '#0f0f10',
  margin: '0 0 20px',
  letterSpacing: '-0.01em',
}
const text = {
  fontSize: '15px',
  color: '#3f3f46',
  lineHeight: '1.6',
  margin: '0 0 18px',
}
const mono = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: '14px',
  color: '#0f0f10',
}
const buttonWrap = { textAlign: 'center' as const, margin: '28px 0 20px' }
const button = {
  backgroundColor: '#292929',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 600,
  textDecoration: 'none',
  padding: '14px 28px',
  borderRadius: '12px',
  display: 'inline-block',
}
const small = {
  fontSize: '13px',
  color: '#71717a',
  margin: '20px 0 6px',
}
const link = {
  fontSize: '12px',
  color: '#52525b',
  wordBreak: 'break-all' as const,
  margin: '0 0 24px',
}
const footer = {
  fontSize: '12px',
  color: '#a1a1aa',
  margin: '24px 0 0',
  lineHeight: '1.5',
}
