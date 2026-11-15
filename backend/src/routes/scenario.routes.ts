import { Router } from 'express';
import { z } from 'zod';
import { NotFoundError } from '../errors/app-error';
import { requireAuth, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { findScenarioById, listScenarios, loadScenarioSnapshot } from '../repositories/scenario.repository';
import { scenarioIdParams, scenarioRunsQuery } from '../schemas/optimization.schema';
import {
  cloneScenarioSchema,
  compareQuerySchema,
  donationParams,
  donationUpdateSchema,
  recipientParams,
  recipientUpdateSchema,
  roadParams,
  roadUpdateSchema,
  scenarioChangesQuery,
  sensitivitySchema,
  supplyReduceSchema,
  vehicleParams,
  vehicleUpdateSchema,
  type CloneScenarioBody,
  type DonationUpdateBody,
  type RecipientUpdateBody,
  type RoadUpdateBody,
  type SensitivityBody,
  type SupplyReduceBody,
  type VehicleUpdateBody,
} from '../schemas/scenario.schema';
import {
  cloneScenario,
  compareRuns,
  createSensitivityVariant,
  getScenarioChanges,
  reduceSupply,
  updateDonation,
  updateRecipient,
  updateRoadAvailability,
  updateVehicle,
} from '../services/scenario.service';
import { getScenarioRuns } from '../services/run.service';

const router = Router();

// Every scenario endpoint, reads included, is admin-only.
router.use(requireAuth, requireRole('admin'));

router.get('/', async (_req, res) => {
  const scenarios = await listScenarios();
  res.json({ success: true, scenarios });
});

router.get('/:id', validate({ params: scenarioIdParams }), async (req, res) => {
  const scenario = await findScenarioById(String(req.params.id));
  if (!scenario) throw new NotFoundError('No scenario matches that id.');
  res.json({ success: true, scenario });
});

router.get('/:id/snapshot', validate({ params: scenarioIdParams }), async (req, res) => {
  const snapshot = await loadScenarioSnapshot(String(req.params.id));
  if (!snapshot) throw new NotFoundError('No scenario matches that id.');
  res.json({ success: true, snapshot });
});

router.get(
  '/:id/runs',
  validate({ params: scenarioIdParams, query: scenarioRunsQuery }),
  async (req, res) => {
    const query = req.validated.query as z.infer<typeof scenarioRunsQuery>;
    const scenario = await findScenarioById(String(req.params.id));
    if (!scenario) throw new NotFoundError('No scenario matches that id.');

    const runs = await getScenarioRuns(scenario.id, query.page, query.pageSize);
    res.json({ success: true, ...runs });
  },
);

/** Deep copy of a scenario: locations links, roads, donors, recipients, donations, vehicles. */
router.post(
  '/:id/clone',
  validate({ params: scenarioIdParams, body: cloneScenarioSchema }),
  async (req, res) => {
    const body = req.validated.body as CloneScenarioBody;

    const scenario = await cloneScenario({
      sourceScenarioId: String(req.params.id),
      name: body.name,
      description: body.description,
      createdBy: req.auth?.id ?? null,
    });

    res.status(201).json({ success: true, scenario });
  },
);

router.patch(
  '/:id/roads/:roadId',
  validate({ params: roadParams, body: roadUpdateSchema }),
  async (req, res) => {
    const body = req.validated.body as RoadUpdateBody;
    const result = await updateRoadAvailability(
      String(req.params.id),
      String(req.params.roadId),
      body.isAvailable,
    );

    res.json({
      success: true,
      road: result.road,
      changed: result.changed,
      change: result.change,
    });
  },
);

router.patch(
  '/:id/vehicles/:vehicleId',
  validate({ params: vehicleParams, body: vehicleUpdateSchema }),
  async (req, res) => {
    const body = req.validated.body as VehicleUpdateBody;
    const result = await updateVehicle(
      String(req.params.id),
      String(req.params.vehicleId),
      { isAvailable: body.isAvailable, capacityUnits: body.capacityUnits },
      { allowLargeStateSpace: body.allowLargeStateSpace },
    );

    res.json({
      success: true,
      vehicle: result.vehicle,
      changed: result.changed,
      change: result.change,
      stateSpace: result.stateSpace,
    });
  },
);

router.patch(
  '/:id/donations/:donationId',
  validate({ params: donationParams, body: donationUpdateSchema }),
  async (req, res) => {
    const body = req.validated.body as DonationUpdateBody;
    const result = await updateDonation(String(req.params.id), String(req.params.donationId), {
      weightUnits: body.weightUnits,
      valueScore: body.valueScore,
      status: body.status,
    });

    res.json({
      success: true,
      donation: result.donation,
      changed: result.changed,
      change: result.change,
    });
  },
);

router.patch(
  '/:id/recipients/:recipientId',
  validate({ params: recipientParams, body: recipientUpdateSchema }),
  async (req, res) => {
    const body = req.validated.body as RecipientUpdateBody;
    const result = await updateRecipient(String(req.params.id), String(req.params.recipientId), {
      demandUnits: body.demandUnits,
      priorityScore: body.priorityScore,
      isAvailable: body.isAvailable,
    });

    res.json({
      success: true,
      recipient: result.recipient,
      changed: result.changed,
      change: result.change,
    });
  },
);

/** Bulk supply shock: reduce every package weight by `percent`. */
router.post(
  '/:id/supply/reduce',
  validate({ params: scenarioIdParams, body: supplyReduceSchema }),
  async (req, res) => {
    const body = req.validated.body as SupplyReduceBody;
    const result = await reduceSupply(String(req.params.id), body.percent);

    res.json({ success: true, summary: result.summary, change: result.change });
  },
);

/** Clone + disable the N most urgent recipients. The variant is returned, not run. */
router.post(
  '/:id/sensitivity',
  validate({ params: scenarioIdParams, body: sensitivitySchema }),
  async (req, res) => {
    const body = req.validated.body as SensitivityBody;
    const result = await createSensitivityVariant({
      scenarioId: String(req.params.id),
      removeTopUrgencyCount: body.removeTopUrgencyCount,
      createdBy: req.auth?.id ?? null,
      name: body.name,
    });

    res.status(201).json({
      success: true,
      scenario: result.scenario,
      disabledRecipients: result.disabledRecipients,
      changes: result.changes,
      note: result.note,
    });
  },
);

router.get(
  '/:id/changes',
  validate({ params: scenarioIdParams, query: scenarioChangesQuery }),
  async (req, res) => {
    const query = req.validated.query as z.infer<typeof scenarioChangesQuery>;
    const changes = await getScenarioChanges(String(req.params.id), query.limit);
    res.json({ success: true, changes });
  },
);

/** Metric deltas between a base run and a variant run from the same clone family. */
router.get(
  '/:id/compare',
  validate({ params: scenarioIdParams, query: compareQuerySchema }),
  async (req, res) => {
    const query = req.validated.query as z.infer<typeof compareQuerySchema>;
    const comparison = await compareRuns({
      scenarioId: String(req.params.id),
      baseRunId: query.baseRunId,
      variantRunId: query.variantRunId,
    });

    res.json({ success: true, comparison });
  },
);

export default router;
