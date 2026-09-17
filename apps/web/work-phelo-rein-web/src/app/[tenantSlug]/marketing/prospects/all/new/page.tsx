'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ProspectFormLayout } from '@/components/organisms/marketing/ProspectFormLayout';
import {
  CompanyInformationForm,
  CompanyInformationFields,
  CompanyInformationErrors,
} from '@/components/molecules/marketing/CompanyInformationForm';
import {
  ProductServiceForm,
  ProductServiceRow,
} from '@/components/molecules/marketing/ProductServiceForm';
import {
  CompanyLocationForm,
  CompanyLocationFields,
} from '@/components/molecules/marketing/CompanyLocationForm';

const STEPS = [
  'Company Information',
  'Product / Service Info.',
  'Company Location',
  'Sale Stage',
  'Preview',
];

const EMPTY_COMPANY: CompanyInformationFields = {
  companyName: '',
  businessType: '',
  contactName: '',
  phone: '',
  email: '',
  interactionType: '',
  roleJobTitle: '',
  sourceType: '',
  dateContacted: '',
};

const EMPTY_PRODUCT_ROW: ProductServiceRow = {
  id: crypto.randomUUID(),
  productType: '',
  expectedRevenue: '',
  achievedRevenue: '',
  expectedCloseDate: '',
};

export default function NewProspectPage() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const router = useRouter();

  const [currentStep, setCurrentStep] = useState(0);

  const [companyForm, setCompanyForm] = useState<CompanyInformationFields>(EMPTY_COMPANY);
  const [companyErrors, setCompanyErrors] = useState<CompanyInformationErrors>({});

  const [productRows, setProductRows] = useState<ProductServiceRow[]>([EMPTY_PRODUCT_ROW]);
  const [locationForm, setLocationForm] = useState<CompanyLocationFields>({ location: '' });

  function validateStep(): boolean {
    if (currentStep === 0) {
      const next: CompanyInformationErrors = {};
      if (!companyForm.companyName.trim()) next.companyName = 'Company name is required.';
      if (!companyForm.contactName.trim()) next.contactName = 'Contact name is required.';
      if (!companyForm.email.trim()) next.email = 'Email is required.';
      setCompanyErrors(next);
      return Object.keys(next).length === 0;
    }
    return true;
  }

  function handleNext() {
    if (!validateStep()) return;
    if (currentStep < STEPS.length - 1) setCurrentStep((s) => s + 1);
  }

  function handleBack() {
    setCompanyErrors({});
    setCurrentStep((s) => s - 1);
  }

  function handleCancel() {
    router.push(`/${tenantSlug}/marketing/prospects/all`);
  }

  return (
    <ProspectFormLayout
      steps={STEPS}
      currentStep={currentStep}
      tenantSlug={tenantSlug}
      prospectName="Create New Prospect"
      onNext={handleNext}
      onBack={handleBack}
      onCancel={handleCancel}
      nextLabel={currentStep === STEPS.length - 1 ? 'Submit' : 'Next'}
    >
      {currentStep === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 px-8">
          <CompanyInformationForm
            values={companyForm}
            onChange={setCompanyForm}
            errors={companyErrors}
          />
        </div>
      )}
      {currentStep === 1 && <ProductServiceForm rows={productRows} onChange={setProductRows} />}
      {currentStep === 2 && (
        <CompanyLocationForm values={locationForm} onChange={setLocationForm} />
      )}
      {currentStep === 3 && <div />}
      {currentStep === 4 && <div />}
    </ProspectFormLayout>
  );
}
