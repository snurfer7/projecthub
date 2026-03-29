import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const data = {
    name: 'DEBUG_COMPANY_' + Date.now(),
    legalEntityStatusId: 1, // Assuming shorthand for 株式会社
    legalEntityPosition: '前',
    postalCode: '534-0001',
    prefecture: '大阪府',
    city: '大阪市都島区',
    street: '毛馬町2丁目2-8',
    building: '',
    phone: '0669271101',
    fax: '',
    website: 'https://example.com',
    notes: '',
    latitude: 34.720898,
    longitude: 135.524734,
  };

  try {
    const result = await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: data.name,
          legalEntityStatusId: data.legalEntityStatusId,
          legalEntityPosition: data.legalEntityPosition,
          website: data.website,
          notes: data.notes,
        } as any,
      });

      console.log('Company created:', company.id);

      const location = await tx.location.create({
        data: {
          companyId: company.id,
          name: '本社',
          phone: data.phone,
          fax: data.fax,
          postalCode: data.postalCode,
          prefecture: data.prefecture,
          city: data.city,
          street: data.street,
          building: data.building,
          latitude: data.latitude,
          longitude: data.longitude,
        }
      });

      console.log('Location created:', location.id);
      return { company, location };
    });
    console.log('Success:', result);
  } catch (e) {
    console.error('Error detail:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
