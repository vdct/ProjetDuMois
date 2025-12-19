-- Set contrib on affected labels
\timing

with uncontributed as (
	SELECT distinct osmid
	FROM :labels_table
	WHERE contrib is null
), numUncontrib as ( -- Forced to renumber rows as versions aren't necessary continuous
	SELECT f.osmid, f.version, row_number() over (PARTITION BY f.osmid order by f.version) as rn
	FROM :features_table f
	JOIN uncontributed u ON f.osmid=u.osmid
), labelContrib as (select fl.osmid, fl.version, fl.label, 
	CASE 
	  WHEN LAG(rn) over wbkwd != rn-1 OR LAG(label) over wbkwd IS NULL THEN 'edit-in'
	  ELSE 'edit'
	END as contrib
	FROM :labels_table fl
	JOIN numUncontrib nu ON fl.osmid=nu.osmid AND fl.version=nu.version
	WINDOW wbkwd AS (PARTITION BY fl.osmid, fl.label ORDER BY nu.rn)
	ORDER BY fl.version, fl.label
)

UPDATE :labels_table fl SET contrib=c.contrib FROM labelContrib c WHERE c.osmid=fl.osmid AND c.version=fl.version AND c.label=fl.label;