import { Router } from 'express';
import type { Request } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  donationCreateSchema,
  donationUpdateSchema,
  portalIdParams,
  portalScenarioParams,
  recipientUpdateSchema,
  vehicleCreateSchema,
  vehicleUpdateSchema,
  type DonationCreateBody,
  type RecipientUpdateBody,
  type VehicleCreateBody,
} from '../schemas/portal.schema';
import {
  createDonation,
  createVehicle,
  getDeliveryWorkspace,
  getDonorWorkspace,
  getRecipientWorkspace,
  getScenarioLocations,
  getScenarios,
  removeDonation,
  removeVehicle,
  updateDonation,
  updateRecipientProfile,
  updateVehicle,
} from '../services/portal.service';

const router = Router();

router.use(requireAuth);

function userIdOf(req: Request): string {
  return req.auth!.id;
}

router.get('/scenarios', async (_req, res) => {
  res.json({ success: true, scenarios: await getScenarios() });
});

router.get(
  '/scenarios/:id/locations',
  validate({ params: portalScenarioParams }),
  async (req, res) => {
    const locations = await getScenarioLocations(String(req.params.id));
    res.json({ success: true, locations });
  },
);

/* Food donor --------------------------------------------------------------- */

const donor = Router();
donor.use(requireRole('donor'));

donor.get('/', async (req, res) => {
  res.json({ success: true, workspace: await getDonorWorkspace(userIdOf(req)) });
});

donor.post('/donations', validate({ body: donationCreateSchema }), async (req, res) => {
  const body = req.validated.body as DonationCreateBody;
  const donation = await createDonation(userIdOf(req), body);
  res.status(201).json({ success: true, donation });
});

donor.put(
  '/donations/:id',
  validate({ params: portalIdParams, body: donationUpdateSchema }),
  async (req, res) => {
    const body = req.validated.body as DonationCreateBody;
    const donation = await updateDonation(userIdOf(req), String(req.params.id), body);
    res.json({ success: true, donation });
  },
);

donor.delete('/donations/:id', validate({ params: portalIdParams }), async (req, res) => {
  await removeDonation(userIdOf(req), String(req.params.id));
  res.json({ success: true });
});

/* Food recipient ----------------------------------------------------------- */

const recipient = Router();
recipient.use(requireRole('recipient'));

recipient.get('/', async (req, res) => {
  res.json({ success: true, workspace: await getRecipientWorkspace(userIdOf(req)) });
});

recipient.patch('/', validate({ body: recipientUpdateSchema }), async (req, res) => {
  const body = req.validated.body as RecipientUpdateBody;
  const updated = await updateRecipientProfile(userIdOf(req), body);
  res.json({ success: true, recipient: updated });
});

/* Delivery partner --------------------------------------------------------- */

const delivery = Router();
delivery.use(requireRole('delivery'));

delivery.get('/', async (req, res) => {
  res.json({ success: true, workspace: await getDeliveryWorkspace(userIdOf(req)) });
});

delivery.post('/vehicles', validate({ body: vehicleCreateSchema }), async (req, res) => {
  const body = req.validated.body as VehicleCreateBody;
  const vehicle = await createVehicle(userIdOf(req), body);
  res.status(201).json({ success: true, vehicle });
});

delivery.put(
  '/vehicles/:id',
  validate({ params: portalIdParams, body: vehicleUpdateSchema }),
  async (req, res) => {
    const body = req.validated.body as VehicleCreateBody;
    const vehicle = await updateVehicle(userIdOf(req), String(req.params.id), body);
    res.json({ success: true, vehicle });
  },
);

delivery.delete('/vehicles/:id', validate({ params: portalIdParams }), async (req, res) => {
  await removeVehicle(userIdOf(req), String(req.params.id));
  res.json({ success: true });
});

router.use('/donor', donor);
router.use('/recipient', recipient);
router.use('/delivery', delivery);

export default router;
