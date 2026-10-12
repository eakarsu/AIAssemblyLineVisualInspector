window.nativeWorkflowConfig = {
  "title": "Assembly Line Visual Inspector",
  "features": [
    {
      "id": "ai-detect-defects",
      "endpoint": "/ai/detect-defects",
      "title": "Detect defects",
      "description": "Examples are illustrative. Confirm source data and review the response before taking operational action.",
      "fields": [
        {
          "key": "image_description",
          "type": "text",
          "required": false,
          "label": "Image description",
          "presets": [
            "Close-up of a stamped steel bracket with a shallow burr along the mounting hole.",
            "Inline camera view of a filled bottle with a skewed cap and intact tamper band.",
            "Top-down view of a circuit board showing a possible solder bridge beside the connector."
          ],
          "manual": false
        },
        {
          "key": "product_type",
          "type": "text",
          "required": false,
          "label": "Product type",
          "presets": [
            "Stamped steel bracket",
            "Bottled beverage",
            "Assembled circuit board"
          ],
          "manual": false
        },
        {
          "key": "inspection_context",
          "type": "text",
          "required": false,
          "label": "Inspection context",
          "presets": [
            "Sample fixture: inspect the mounting hole edge under diffuse lighting; confirm scale before measuring the burr.",
            "Sample fixture: inspect cap angle and tamper band from two camera views; confirm torque separately.",
            "Sample fixture: compare suspected solder bridge against a clean board image; verify continuity before release."
          ],
          "manual": false
        }
      ],
      "source": {
        "file": "backend/src/routes/aiAnalysis.js",
        "line": 146
      }
    },
    {
      "id": "ai-classify-defect",
      "endpoint": "/ai/classify-defect",
      "title": "Classify defect",
      "description": "Examples are illustrative. Confirm source data and review the response before taking operational action.",
      "fields": [
        {
          "key": "defect_description",
          "type": "text",
          "required": false,
          "label": "Defect description",
          "presets": [
            "Raised burr on the bracket mounting hole, about 2 mm long.",
            "Cap sits visibly off axis while the tamper band remains intact.",
            "Potential solder bridge between adjacent connector pins."
          ],
          "manual": false
        },
        {
          "key": "product_type",
          "type": "text",
          "required": false,
          "label": "Product type",
          "presets": [
            "Stamped steel bracket",
            "Bottled beverage",
            "Assembled circuit board"
          ],
          "manual": false
        },
        {
          "key": "additional_context",
          "type": "text",
          "required": false,
          "label": "Additional context",
          "presets": [
            "Sample case: burr appeared after a die change and is localized to one cavity.",
            "Sample case: cap angle drift began on the evening shift after a guide rail adjustment.",
            "Sample case: solder bridges cluster beside the connector after paste refill."
          ],
          "manual": false
        }
      ],
      "source": {
        "file": "backend/src/routes/aiAnalysis.js",
        "line": 187
      }
    },
    {
      "id": "ai-quality-prediction",
      "endpoint": "/ai/quality-prediction",
      "title": "Quality prediction",
      "description": "Examples are illustrative. Confirm source data and review the response before taking operational action.",
      "fields": [
        {
          "key": "historical_data",
          "type": "text",
          "required": false,
          "label": "Historical data",
          "presets": [
            "Last 30 shifts: 12,400 brackets inspected, 86 burr rejects, 18 dimensional rejects.",
            "Last 14 days: 8,200 bottles inspected, 61 cap alignment rejects, 14 seal rejects.",
            "Last 20 batches: 6,100 boards inspected, 42 solder bridge rejects, 9 missing parts."
          ],
          "manual": false
        },
        {
          "key": "production_parameters",
          "type": "text",
          "required": false,
          "label": "Production parameters",
          "presets": [
            "Press speed 42 strokes/min; die temperature 31 C; tool age 18,000 strokes.",
            "Capper speed 180 bottles/min; torque set point 1.4 Nm; rinse temperature 22 C.",
            "Reflow peak 242 C; conveyor speed 0.8 m/min; stencil age 6 hours."
          ],
          "manual": false
        },
        {
          "key": "time_horizon",
          "type": "number",
          "required": false,
          "label": "Time horizon",
          "presets": [
            7,
            14,
            30
          ],
          "manual": false
        }
      ],
      "source": {
        "file": "backend/src/routes/aiAnalysis.js",
        "line": 227
      }
    },
    {
      "id": "ai-root-cause",
      "endpoint": "/ai/root-cause",
      "title": "Root cause",
      "description": "Examples are illustrative. Confirm source data and review the response before taking operational action.",
      "fields": [
        {
          "key": "defect_data",
          "type": "text",
          "required": false,
          "label": "Defect data",
          "presets": [
            "Burr rejects rose from 3 to 11 per shift after tool change; inspect hole edge.",
            "Cap misalignment reached 9 per 1,000 bottles on the evening shift.",
            "Solder bridge rejects increased from 1 to 7 per board lot after paste refill."
          ],
          "manual": false
        },
        {
          "key": "process_parameters",
          "type": "text",
          "required": false,
          "label": "Process parameters",
          "presets": [
            "Press speed 42 strokes/min; die clearance 0.18 mm; tool changed at shift start.",
            "Capper speed 180 bottles/min; torque target 1.4 Nm; guide rail adjusted yesterday.",
            "Stencil pressure 5.5 kg; reflow peak 242 C; paste mixed at lot start."
          ],
          "manual": false
        },
        {
          "key": "environmental_conditions",
          "type": "text",
          "required": false,
          "label": "Environmental conditions",
          "presets": [
            "Shop temperature 24 C; relative humidity 46%; no reported utility interruption.",
            "Packaging area 21 C; relative humidity 52%; compressed air pressure stable.",
            "Assembly area 23 C; relative humidity 38%; humidity alarm occurred once."
          ],
          "manual": false
        },
        {
          "key": "machine_data",
          "type": "text",
          "required": false,
          "label": "Machine data",
          "presets": [
            "Press vibration 2.1 mm/s; motor current 18 A; tool count 18,000 strokes.",
            "Capper torque readings span 1.1 to 1.6 Nm; two head alarms logged.",
            "Printer squeegee pressure 5.5 kg; conveyor speed 0.8 m/min."
          ],
          "manual": false
        }
      ],
      "source": {
        "file": "backend/src/routes/aiAnalysis.js",
        "line": 265
      }
    },
    {
      "id": "ai-recommendations",
      "endpoint": "/ai/recommendations",
      "title": "Recommendations",
      "description": "Examples are illustrative. Confirm source data and review the response before taking operational action.",
      "fields": [
        {
          "key": "quality_data",
          "type": "text",
          "required": false,
          "label": "Quality data",
          "presets": [
            "Bracket first-pass yield 97.8%; burr rejects account for 58% of defects.",
            "Bottle first-pass yield 98.4%; cap alignment drives 43% of rejects.",
            "Board first-pass yield 96.9%; solder defects drive 62% of rework."
          ],
          "manual": false
        },
        {
          "key": "production_context",
          "type": "text",
          "required": false,
          "label": "Production context",
          "presets": [
            "Sample case: one press line runs two shifts at 42 strokes/min; die changed today.",
            "Sample case: capper operates at 180 bottles/min on evening shift; hold threshold is 10 rejects per 1,000.",
            "Sample case: board assembly uses a six hour stencil cycle; reflow peak target is 242 C."
          ],
          "manual": false
        },
        {
          "key": "current_issues",
          "type": "text",
          "required": false,
          "label": "Current issues",
          "presets": [
            "Burr rejects cluster around one die cavity; measurement repeatability needs confirmation.",
            "Cap angle drifts after a capper head change; verify torque and camera calibration.",
            "Solder bridges cluster near one connector; check stencil cleaning records."
          ],
          "manual": false
        },
        {
          "key": "goals",
          "type": "text",
          "required": false,
          "label": "Goals",
          "presets": [
            "Reduce bracket burr rejects below 4 per shift while maintaining throughput.",
            "Reduce cap alignment rejects below 5 per 1,000 bottles within six weeks.",
            "Reduce solder bridge rework below 2 boards per lot without raising false rejects."
          ],
          "manual": false
        }
      ],
      "source": {
        "file": "backend/src/routes/aiAnalysis.js",
        "line": 304
      }
    },
    {
      "id": "ai-analyze-image",
      "endpoint": "/ai/analyze-image",
      "title": "Analyze image",
      "description": "Choose an actual source image. This native provider result is an inspection draft for authorized review.",
      "fields": [
        {
          "key": "image",
          "label": "Source image",
          "type": "file",
          "required": true,
          "manual": true,
          "accept": "image/*"
        }
      ],
      "source": {
        "file": "backend/src/routes/aiAnalysis.js",
        "line": 344
      }
    },
    {
      "id": "ai-predict-quality",
      "endpoint": "/ai/predict-quality",
      "title": "Predict quality",
      "description": "Examples are illustrative. Confirm source data and review the response before taking operational action.",
      "fields": [
        {
          "key": "production_line_id",
          "type": "text",
          "required": true,
          "label": "Production line id",
          "manual": true,
          "resource": "production-lines"
        },
        {
          "key": "current_metrics",
          "type": "text",
          "required": false,
          "label": "Current metrics",
          "presets": [
            "Current line yield 97.8%; 11 burr rejects in the latest shift; 42 units/min.",
            "Current line yield 98.4%; 9 cap alignment rejects per 1,000 units.",
            "Current line yield 96.9%; 7 solder bridge rejects in the latest lot."
          ],
          "manual": false
        }
      ],
      "source": {
        "file": "backend/src/routes/aiAnalysis.js",
        "line": 439
      }
    },
    {
      "id": "ai-defect-trend-forecast",
      "endpoint": "/ai/defect-trend-forecast",
      "title": "Defect trend forecast",
      "description": "Examples are illustrative. Confirm source data and review the response before taking operational action.",
      "fields": [
        {
          "key": "production_line_id",
          "type": "text",
          "required": true,
          "label": "Production line id",
          "manual": true,
          "resource": "production-lines"
        },
        {
          "key": "product_type",
          "type": "text",
          "required": false,
          "label": "Product type",
          "presets": [
            "Stamped steel bracket",
            "Bottled beverage",
            "Assembled circuit board"
          ],
          "manual": false
        },
        {
          "key": "lookback_days",
          "type": "number",
          "required": false,
          "label": "Lookback days",
          "presets": [
            7,
            14,
            30
          ],
          "manual": false
        }
      ],
      "source": {
        "file": "backend/src/routes/aiAnalysis.js",
        "line": 504
      }
    },
    {
      "id": "ai-operator-scorecard",
      "endpoint": "/ai/operator-scorecard",
      "title": "Operator scorecard",
      "description": "Examples are illustrative. Confirm source data and review the response before taking operational action.",
      "fields": [
        {
          "key": "operator_id",
          "type": "text",
          "required": false,
          "label": "Operator id",
          "manual": true,
          "resource": "operators"
        },
        {
          "key": "period_days",
          "type": "number",
          "required": false,
          "label": "Period days",
          "presets": [
            7,
            14,
            30
          ],
          "manual": false
        }
      ],
      "source": {
        "file": "backend/src/routes/aiAnalysis.js",
        "line": 556
      }
    },
    {
      "id": "ai-cross-line-correlation",
      "endpoint": "/ai/cross-line-correlation",
      "title": "Cross line correlation",
      "description": "Examples are illustrative. Confirm source data and review the response before taking operational action.",
      "fields": [
        {
          "key": "line_ids",
          "type": "json",
          "required": false,
          "label": "Line ids",
          "manual": true
        },
        {
          "key": "lookback_days",
          "type": "number",
          "required": false,
          "label": "Lookback days",
          "presets": [
            7,
            14,
            30
          ],
          "manual": false
        }
      ],
      "source": {
        "file": "backend/src/routes/aiAnalysis.js",
        "line": 613
      }
    },
    {
      "id": "ai-supplier-quality-risk",
      "endpoint": "/ai/supplier-quality-risk",
      "title": "Supplier quality risk",
      "description": "Examples are illustrative. Confirm source data and review the response before taking operational action.",
      "fields": [
        {
          "key": "supplier_data",
          "type": "text",
          "required": false,
          "label": "Supplier data",
          "presets": [
            "Supplier A delivered 12 bracket lots; 3 lots had edge-burr complaints.",
            "Supplier B delivered 8 cap lots; 2 showed elevated torque variation.",
            "Supplier C delivered 10 solder-paste lots; 1 had viscosity outliers."
          ],
          "manual": false
        },
        {
          "key": "defects_summary",
          "type": "text",
          "required": false,
          "label": "Defects summary",
          "presets": [
            "Three of twelve bracket lots have elevated edge-burr complaints; lot-level counts need confirmation.",
            "Two of eight cap lots show wider torque spread and more cap alignment rejects.",
            "One of ten solder-paste lots coincides with a solder bridge increase; verify batch traceability."
          ],
          "manual": false
        }
      ],
      "source": {
        "file": "backend/src/routes/aiAnalysis.js",
        "line": 663
      }
    },
    {
      "id": "ai-containment-action",
      "endpoint": "/ai/containment-action",
      "title": "Containment action",
      "description": "Examples are illustrative. Confirm source data and review the response before taking operational action.",
      "fields": [
        {
          "key": "defect_severity",
          "type": "text",
          "required": true,
          "label": "Defect severity",
          "presets": [
            "Major",
            "Critical",
            "Minor"
          ],
          "manual": false
        },
        {
          "key": "defect_description",
          "type": "text",
          "required": true,
          "label": "Defect description",
          "presets": [
            "Raised burr on the bracket mounting hole, about 2 mm long.",
            "Cap sits visibly off axis while the tamper band remains intact.",
            "Potential solder bridge between adjacent connector pins."
          ],
          "manual": false
        },
        {
          "key": "batch_id",
          "type": "text",
          "required": false,
          "label": "Batch id",
          "manual": true,
          "resource": "batches"
        },
        {
          "key": "production_line_id",
          "type": "text",
          "required": true,
          "label": "Production line id",
          "manual": true,
          "resource": "production-lines"
        },
        {
          "key": "customer_impact",
          "type": "text",
          "required": false,
          "label": "Customer impact",
          "presets": [
            "No shipment confirmed; quarantine affected work in progress pending traceability review.",
            "Potential field leakage if caps fail seal inspection; verify distribution holds.",
            "No known customer complaints; assess rework and shipment status before release."
          ],
          "manual": false
        }
      ],
      "source": {
        "file": "backend/src/routes/aiAnalysis.js",
        "line": 698
      }
    },
    {
      "id": "ai-maintenance-prediction",
      "endpoint": "/ai/maintenance-prediction",
      "title": "Maintenance prediction",
      "description": "Examples are illustrative. Confirm source data and review the response before taking operational action.",
      "fields": [
        {
          "key": "equipment_id",
          "type": "text",
          "required": false,
          "label": "Equipment id",
          "manual": true
        },
        {
          "key": "sensor_data",
          "type": "text",
          "required": false,
          "label": "Sensor data",
          "presets": [
            "Bearing vibration 2.1 mm/s; motor current 18 A; temperature 52 C.",
            "Capper head vibration 3.0 mm/s; torque spread 1.1 to 1.6 Nm.",
            "Conveyor motor current 11 A; housing temperature 59 C; vibration trending upward."
          ],
          "manual": false
        },
        {
          "key": "recent_defects",
          "type": "text",
          "required": false,
          "label": "Recent defects",
          "presets": [
            "11 burr rejects this shift, concentrated at one die cavity.",
            "9 cap misalignment rejects per 1,000 bottles on the evening shift.",
            "7 solder bridge rejects in the latest board lot."
          ],
          "manual": false
        }
      ],
      "source": {
        "file": "backend/src/routes/aiAnalysis.js",
        "line": 737
      }
    },
    {
      "id": "ai-training-grader",
      "endpoint": "/ai/training-grader",
      "title": "Training grader",
      "description": "Examples are illustrative. Confirm source data and review the response before taking operational action.",
      "fields": [
        {
          "key": "trainee_annotations",
          "type": "text",
          "required": true,
          "label": "Trainee annotations",
          "presets": [
            "Trainee flagged 8 of 10 burr images and marked 1 false positive.",
            "Trainee identified 7 of 10 cap alignment defects and missed 2 subtle cases.",
            "Trainee identified 9 of 10 solder bridges and missed one edge case."
          ],
          "manual": false
        },
        {
          "key": "expert_baseline",
          "type": "text",
          "required": false,
          "label": "Expert baseline",
          "presets": [
            "Expert labeled 10 burr images: 9 positive and 1 clean.",
            "Expert labeled 10 cap images: 8 positive and 2 clean.",
            "Expert labeled 10 board images: 9 bridge defects and 1 clean."
          ],
          "manual": false
        },
        {
          "key": "defect_categories",
          "type": "json",
          "required": false,
          "label": "Defect categories",
          "presets": [
            [
              "Burr",
              "Dimensional"
            ],
            [
              "Cap alignment",
              "Seal"
            ],
            [
              "Solder bridge",
              "Missing component"
            ]
          ],
          "manual": false
        }
      ],
      "source": {
        "file": "backend/src/routes/aiAnalysis.js",
        "line": 771
      }
    },
    {
      "id": "ai-yield-optimizer",
      "endpoint": "/ai/yield-optimizer",
      "title": "Yield optimizer",
      "description": "Examples are illustrative. Confirm source data and review the response before taking operational action.",
      "fields": [
        {
          "key": "current_yield",
          "type": "text",
          "required": false,
          "label": "Current yield",
          "presets": [
            "97.8% first-pass yield across the last 30 bracket shifts.",
            "98.4% first-pass yield across the last 14 bottle days.",
            "96.9% first-pass yield across the last 20 board batches."
          ],
          "manual": false
        },
        {
          "key": "factors",
          "type": "text",
          "required": false,
          "label": "Factors",
          "presets": [
            "Die wear, press speed, and inspection lighting.",
            "Capper head alignment, torque variation, and guide rail position.",
            "Stencil cleaning interval, paste age, and reflow profile."
          ],
          "manual": false
        },
        {
          "key": "target_yield",
          "type": "text",
          "required": false,
          "label": "Target yield",
          "presets": [
            "98.5% first-pass yield within four weeks.",
            "99.0% first-pass yield within six weeks.",
            "98.0% first-pass yield within eight weeks."
          ],
          "manual": false
        }
      ],
      "source": {
        "file": "backend/src/routes/aiAnalysis.js",
        "line": 811
      }
    }
  ],
  "resources": [
    {
      "key": "production-lines",
      "endpoint": "/production-lines",
      "label": "Production lines",
      "fields": [
        "name",
        "location",
        "speed_units_per_hour",
        "product_type",
        "last_maintenance"
      ],
      "updateFields": [
        "name",
        "location",
        "status",
        "speed_units_per_hour",
        "product_type",
        "last_maintenance"
      ],
      "delete": true,
      "source": "backend/src/routes/productionLines.js"
    },
    {
      "key": "inspections",
      "endpoint": "/inspections",
      "label": "Inspections",
      "fields": [
        "production_line_id",
        "camera_feed_id",
        "product_id",
        "batch_id",
        "operator_id",
        "defect_types",
        "image_url",
        "inspected_at"
      ],
      "updateFields": [
        "production_line_id",
        "camera_feed_id",
        "product_id",
        "batch_id",
        "operator_id",
        "status",
        "defect_count",
        "defect_types",
        "confidence_score",
        "ai_analysis",
        "image_url",
        "inspected_at"
      ],
      "delete": true,
      "source": "backend/src/routes/inspections.js"
    },
    {
      "key": "operators",
      "endpoint": "/operators",
      "label": "Operators",
      "fields": [],
      "delete": false
    },
    {
      "key": "batches",
      "endpoint": "/batches",
      "label": "Batches",
      "fields": [],
      "delete": false
    }
  ]
};
