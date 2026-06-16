import React from 'react';
import { render } from '@testing-library/react';
import { ReactFlowProvider } from 'reactflow';
import ObjetNode from '../components/nodes/ObjetNode';
import InteractionNode from '../components/nodes/InteractionNode';
import GesteNode from '../components/nodes/GesteNode';
import EntityNode from '../components/nodes/EntityNode';
import ActionNode from '../components/nodes/ActionNode';

describe('Nodes', () => {
  const renderNode = (node) => render(<ReactFlowProvider>{node}</ReactFlowProvider>);

  it('ObjetNode rend sans crash', () => {
    renderNode(<ObjetNode data={{}} />);
  });
  it('InteractionNode rend sans crash', () => {
    renderNode(<InteractionNode data={{}} />);
  });
  it('GesteNode rend sans crash', () => {
    renderNode(<GesteNode data={{}} />);
  });
  it('EntityNode rend sans crash', () => {
    renderNode(<EntityNode data={{}} />);
  });
  it('ActionNode rend sans crash', () => {
    renderNode(<ActionNode data={{}} />);
  });
});
