// Product-route entry of the grouped block module, imported only by
// ProductBlocksWarmup. A separate module on purpose: Turbopack keys an
// async loader by its target module, so importing ./productBlocks.client
// here would reuse the store layout's loader (and its chunk list, which
// repeats code the product page already ships). Through this module the
// chunk group is computed against the product page's own modules. See
// ./productBlocksLoader.ts.

export * from './productBlocks.client';
