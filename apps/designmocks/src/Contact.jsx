import React from 'react';
import { operator } from './operator.js';

export function OperatorDetails() {
  return <section aria-label="Operator and contact">
    <h2>Operator and contact</h2>
    <p>DMocks is operated by <strong>{operator.legalName}</strong>, a {operator.organisationType.toLowerCase()} of {operator.proprietor}.</p>
    <p>{operator.address.map((line, index) => <React.Fragment key={line}>{index > 0 && <br />}{line}</React.Fragment>)}</p>
    <p>Email: <a href={'mailto:' + operator.supportEmail}>{operator.supportEmail}</a></p>
    <p>Udyam registration: {operator.udyamRegistration}</p>
    <p>GSTIN: {operator.gstin ?? 'Not recorded in the supplied registration.'}</p>
  </section>;
}

export function Contact() {
  return <section className="wrap policy section">
    <span className="eyebrow">DMOCKS / CONTACT</span>
    <h1>Contact DMocks.</h1>
    <p>For account, practice or purchase support, email the team. Include the page and a short description of the issue. Keep passwords, sign-in codes and card details out of your message.</p>
    <OperatorDetails />
  </section>;
}
