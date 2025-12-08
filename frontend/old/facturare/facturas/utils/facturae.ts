/*
  Minimal Facturae 3.2 XML generator (frontend-side)
  - Pure function: toFacturaeXML(invoice)
  - Optional PaymentDetails when method is transfer/domicialiado and IBAN exists
  - Avoids empty nodes
  - Formats numbers per requirements
*/

type InvoiceItem = {
  descripcion?: string;
  cantidad?: number;
  precioUnitario?: number;
  tva?: number; // IVA %
  descuento?: number; // %
};

type InvoiceModel = {
  numero?: string;
  serie?: string;
  fecha?: string; // ISO date
  moneda?: string; // default EUR
  language?: string; // default es
  items?: InvoiceItem[];
  subtotal?: number;
  totalTVA?: number;
  totalRetencion?: number;
  total?: number;
  observaciones?: string;
  metodoPago?: string; // hint for payment means
  cliente?: string; // buyer name (fallback)
  // Optional structured parties (if available)
  seller?: {
    cif?: string;
    nombre?: string;
    direccion?: string;
    cp?: string;
    ciudad?: string;
    provincia?: string;
    pais?: string; // ESP
  };
  buyer?: {
    cif?: string;
    nombre?: string;
    direccion?: string;
    cp?: string;
    ciudad?: string;
    provincia?: string;
    pais?: string; // ESP
  };
};

const xmlEscape = (s: string | number | null | undefined) => String(s ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

const fmt2 = (n?: number) => (Number(n || 0)).toFixed(2);
const fmt6 = (n?: number) => (Number(n || 0)).toFixed(6);

const hasText = (v?: string) => v != null && String(v).trim() !== '';

function buildAddress(tag: 'SellerParty' | 'BuyerParty', party?: InvoiceModel['seller']) {
  if (!party) return '';
  const hasAny = party.direccion || party.cp || party.ciudad || party.provincia || party.pais;
  const cif = hasText(party.cif) ? party.cif : undefined;
  const name = hasText(party.nombre) ? party.nombre : undefined;
  if (!hasAny && !cif && !name) return '';
  return `
    <${tag}>
      <TaxIdentification>
        <PersonTypeCode>J</PersonTypeCode>
        <ResidenceTypeCode>R</ResidenceTypeCode>
        ${cif ? `<TaxIdentificationNumber>${xmlEscape(cif)}</TaxIdentificationNumber>` : ''}
      </TaxIdentification>
      <LegalEntity>
        ${name ? `<CorporateName>${xmlEscape(name)}</CorporateName>` : ''}
        ${hasAny ? `
        <AddressInSpain>
          ${party.direccion ? `<Address>${xmlEscape(party.direccion)}</Address>` : ''}
          ${party.cp ? `<PostCode>${xmlEscape(party.cp)}</PostCode>` : ''}
          ${party.ciudad ? `<Town>${xmlEscape(party.ciudad)}</Town>` : ''}
          ${party.provincia ? `<Province>${xmlEscape(party.provincia)}</Province>` : ''}
          ${party.pais ? `<CountryCode>${xmlEscape(party.pais)}</CountryCode>` : ''}
        </AddressInSpain>` : ''}
      </LegalEntity>
    </${tag}>
  `;
}

export function toFacturaeXML(invoice: InvoiceModel): string {
  const issueDate = invoice.fecha ? invoice.fecha.slice(0, 10) : new Date().toISOString().slice(0, 10);
  const currency = invoice.moneda || 'EUR';
  const lang = invoice.language || 'es';
  const batchId = `${(invoice.seller?.cif || 'B00000000').replace(/\s+/g, '')}${invoice.numero ? '-' + invoice.numero.replace(/\s+/g, '') : ''}`;

  const items = Array.isArray(invoice.items) ? invoice.items : [];

  // Compute taxes summary (simple 1-IVA rate aggregation)
  const taxableBase = Number(invoice.subtotal || 0);
  const taxOutputs = Number(invoice.totalTVA || 0);
  const invoiceTotal = Number(invoice.total || (taxableBase + taxOutputs));

  // Payment Details (only for transfer/domicialiado and IBAN present)
  const enablePaymentDetails = (() => {
    const method = (invoice.metodoPago || '').toLowerCase();
    const notes = (invoice.observaciones || '').toLowerCase();
    const iban = import.meta.env.VITE_EINVOICE_IBAN as string | undefined;
    if (!iban) return false;
    if (method.includes('transfer') || method.includes('domic') || notes.includes('pago domiciliado')) return true;
    return false;
  })();

  const iban = (import.meta.env.VITE_EINVOICE_IBAN as string | undefined) || '';

  const sellerXml = buildAddress('SellerParty', invoice.seller);
  const buyerXml = buildAddress('BuyerParty', invoice.buyer);

  const itemsXml = items.map((it) => {
    const qty = it.cantidad || 1;
    const unit = it.precioUnitario || 0;
    const discount = (it.descuento || 0) / 100;
    const base = qty * unit * (1 - discount);
    const iva = (it.tva || 0);
    return `
      <InvoiceLine>
        ${hasText(it.descripcion) ? `<ItemDescription>${xmlEscape(it.descripcion!)}</ItemDescription>` : ''}
        <Quantity>${fmt2(qty)}</Quantity>
        <UnitOfMeasure>01</UnitOfMeasure>
        <UnitPriceWithoutTax>${fmt6(unit)}</UnitPriceWithoutTax>
        <TotalCost>${fmt6(base)}</TotalCost>
        <GrossAmount>${fmt6(base)}</GrossAmount>
        ${iva > 0 ? `
        <TaxesOutputs>
          <Tax>
            <TaxTypeCode>01</TaxTypeCode>
            <TaxRate>${fmt2(iva)}</TaxRate>
            <TaxableBase><TotalAmount>${fmt2(base)}</TotalAmount></TaxableBase>
            <TaxAmount><TotalAmount>${fmt2(base * (iva/100))}</TotalAmount></TaxAmount>
          </Tax>
        </TaxesOutputs>` : ''}
      </InvoiceLine>
    `;
  }).join('');

  const paymentDetailsXml = enablePaymentDetails ? `
    <PaymentDetails>
      <Installment>
        <PaymentMeans>01</PaymentMeans>
        <InstallmentDueDate>${xmlEscape(issueDate)}</InstallmentDueDate>
        <InstallmentAmount>${fmt2(invoiceTotal)}</InstallmentAmount>
        <PaymentReconciliationReference>${xmlEscape(invoice.numero || '')}</PaymentReconciliationReference>
        <AccountToBeCredited>
          <IBAN>${xmlEscape(iban)}</IBAN>
        </AccountToBeCredited>
      </Installment>
    </PaymentDetails>
  ` : '';

  const xml = `<?xml version="1.0" encoding="utf-8" standalone="yes"?>
<fe:Facturae xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:fe="http://www.facturae.es/Facturae/2009/v3.2/Facturae">
  <FileHeader>
    <SchemaVersion>3.2</SchemaVersion>
    <Modality>I</Modality>
    <InvoiceIssuerType>EM</InvoiceIssuerType>
    <Batch>
      <BatchIdentifier>${xmlEscape(batchId)}</BatchIdentifier>
      <InvoicesCount>1</InvoicesCount>
      <TotalInvoicesAmount><TotalAmount>${fmt2(invoiceTotal)}</TotalAmount></TotalInvoicesAmount>
      <TotalOutstandingAmount><TotalAmount>${fmt2(invoiceTotal)}</TotalAmount></TotalOutstandingAmount>
      <TotalExecutableAmount><TotalAmount>${fmt2(invoiceTotal)}</TotalAmount></TotalExecutableAmount>
      <InvoiceCurrencyCode>${xmlEscape(currency)}</InvoiceCurrencyCode>
    </Batch>
  </FileHeader>
  <Parties>
    ${sellerXml}
    ${buyerXml}
  </Parties>
  <Invoices>
    <Invoice>
      <InvoiceHeader>
        ${invoice.numero ? `<InvoiceNumber>${xmlEscape(invoice.numero)}</InvoiceNumber>` : ''}
        ${invoice.serie ? `<InvoiceSeriesCode>${xmlEscape(invoice.serie)}</InvoiceSeriesCode>` : ''}
        <InvoiceDocumentType>FC</InvoiceDocumentType>
        <InvoiceClass>OO</InvoiceClass>
      </InvoiceHeader>
      <InvoiceIssueData>
        <IssueDate>${xmlEscape(issueDate)}</IssueDate>
        <InvoiceCurrencyCode>${xmlEscape(currency)}</InvoiceCurrencyCode>
        <TaxCurrencyCode>${xmlEscape(currency)}</TaxCurrencyCode>
        <LanguageName>${xmlEscape(lang)}</LanguageName>
      </InvoiceIssueData>
      ${taxOutputs > 0 ? `
      <TaxesOutputs>
        <Tax>
          <TaxTypeCode>01</TaxTypeCode>
          <TaxRate>${fmt2((invoice.totalTVA || 0) && taxableBase ? 100 * (taxOutputs / taxableBase) : 21)}</TaxRate>
          <TaxableBase><TotalAmount>${fmt2(taxableBase)}</TotalAmount></TaxableBase>
          <TaxAmount><TotalAmount>${fmt2(taxOutputs)}</TotalAmount></TaxAmount>
        </Tax>
      </TaxesOutputs>` : ''}
      <InvoiceTotals>
        <TotalGrossAmount>${fmt2(taxableBase)}</TotalGrossAmount>
        <TotalGeneralDiscounts>0.00</TotalGeneralDiscounts>
        <TotalGeneralSurcharges>0.00</TotalGeneralSurcharges>
        <TotalGrossAmountBeforeTaxes>${fmt2(taxableBase)}</TotalGrossAmountBeforeTaxes>
        <TotalTaxOutputs>${fmt2(taxOutputs)}</TotalTaxOutputs>
        <TotalTaxesWithheld>0.00</TotalTaxesWithheld>
        <InvoiceTotal>${fmt2(invoiceTotal)}</InvoiceTotal>
        <TotalOutstandingAmount>${fmt2(invoiceTotal)}</TotalOutstandingAmount>
        <TotalExecutableAmount>${fmt2(invoiceTotal)}</TotalExecutableAmount>
      </InvoiceTotals>
      <Items>
        ${itemsXml}
      </Items>
      ${invoice.observaciones ? `<AdditionalData><InvoiceAdditionalInformation>${xmlEscape(invoice.observaciones)}</InvoiceAdditionalInformation></AdditionalData>` : ''}
      ${paymentDetailsXml}
    </Invoice>
  </Invoices>
</fe:Facturae>`;

  return xml.replace(/\n\s+\n/g, '\n').trim();
}

export function downloadFacturaeXML(invoice: InvoiceModel) {
  const xml = toFacturaeXML(invoice);
  const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const name = invoice.numero ? `Facturae_${invoice.numero}.xml` : 'Facturae.xml';
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return { success: true };
}


