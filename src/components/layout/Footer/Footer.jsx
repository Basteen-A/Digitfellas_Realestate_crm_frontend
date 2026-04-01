import React from 'react';
import './Footer.css';

const Footer = () => {
  return (
    <footer className="app-footer">
      <span>RealEstate CRM</span>
      <span>{new Date().getFullYear()}</span>
    </footer>
  );
};

export default Footer;
