#!/bin/bash
# porto  estações candidatas (TICON)
declare -A REFS=(
 [suape]="suape-710a-bra-uhslc_rq"
 [salvador]="salvador_uscgs-708-bra-uhslc_fd salvador-708b-bra-uhslc_rq"
 [santos]="cananeia-281-bra-uhslc_fd ubatuba-282a-bra-uhslc_rq"
 [paranagua]="cananeia-281-bra-uhslc_fd imbituba-718a-bra-uhslc_rq"
 [rio-de-janeiro]="ilha_fiscal_rj-280-bra-uhslc_fd rio_de_janeiro_cg-709a-bra-uhslc_rq"
 [itaqui]="madeira-715a-bra-uhslc_rq"
 [vitoria]="macae-719a-bra-uhslc_rq canavieiras_uscgs-707a-bra-uhslc_rq"
 [pecem]="fortaleza-283-bra-uhslc_fd fortaleza_uscgs-283a-bra-uhslc_rq"
 [vila-do-conde]="belem_uscgs-229a-bra-uhslc_rq"
 [rio-grande]="rio_grande-714a-bra-uhslc_rq"
 [itajai]="imbituba-718a-bra-uhslc_rq cananeia-281-bra-uhslc_fd"
 [sepetiba]="ilha_fiscal_rj-280-bra-uhslc_fd rio_de_janeiro_cg-709a-bra-uhslc_rq ubatuba-282a-bra-uhslc_rq"
)
for p in suape salvador santos paranagua rio-de-janeiro itaqui vitoria pecem vila-do-conde rio-grande itajai sepetiba; do
  for r in ${REFS[$p]}; do
    out=$(node calib.mjs dhn/$p.txt ticon/$r 10 11 2>&1)
    cp dhn/$p.fit.json fit/${p}__${r%%-*}.json
    echo "$out" | grep -E "ANTES|ESCOLHIDO" | sed "s/^/[$p ← ${r%%-*}] /"
  done
done
